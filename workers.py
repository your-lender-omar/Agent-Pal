"""Background workers for Gmail, Google Calendar and Airtable.

Each worker is a daemon thread that polls on an interval and puts new Items on a shared queue.
The GUI thread drains that queue (see app.py), so workers never touch Qt objects.

Credentials come from environment variables:
  GMAIL_ACCESS_TOKEN             OAuth bearer token with the gmail.readonly scope
  GOOGLE_CALENDAR_ACCESS_TOKEN   OAuth bearer token with the calendar.readonly scope
  AIRTABLE_API_KEY               Airtable personal access token
  AIRTABLE_BASE_ID               e.g. appXXXXXXXXXXXXXX
  AIRTABLE_TABLE_NAME            table name or id

A worker with missing credentials runs in mock mode: it logs one warning and emits simulated
items, so the app runs and the reward system can be tested without any keys.
Live tokens from Google expire after about an hour. Refreshing them is not handled here.
"""

import logging
import os
import queue
import threading
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Callable

import requests

log = logging.getLogger("workers")
REQUEST_TIMEOUT = 15


@dataclass(frozen=True)
class Item:
    source: str    # "gmail" | "calendar" | "airtable"
    item_id: str   # unique per item version; a new id means a new item
    text: str      # summary shown to the user and fed to the brain


MOCK_EMAILS = [
    "Email from Priya: Can you review the budget draft by Friday?",
    "Email from billing: Invoice 2231 is 14 days overdue.",
    "Email from newsletter: Ten tips for better sleep this week.",
    "Email from Sam: Lunch tomorrow at noon?",
]
MOCK_CALENDAR = [
    "Meeting: Sprint planning at 10:00. Agenda: review the backlog.",
    "Meeting: Dentist appointment at 15:30.",
    "Meeting: 1:1 with manager at 16:00.",
]
MOCK_CRM = [
    "CRM update: Acme Corp renewal marked as signed.",
    "CRM update: New lead added: Blue Harbor Ltd, interested in pricing.",
    "CRM update: Support ticket #812 escalated to urgent.",
]


class PollingWorker(threading.Thread):
    """Polls fetch() on an interval and queues items it has not sent before."""

    source = "base"
    live_interval_s = 60
    mock_interval_s = 20

    def __init__(self, out: queue.Queue, stop_event: threading.Event) -> None:
        super().__init__(name=f"{self.source}-worker", daemon=True)
        self.out = out
        self.stop_event = stop_event
        self.mock = not self.has_credentials()
        self.interval = self.mock_interval_s if self.mock else self.live_interval_s
        self._seen: set[str] = set()
        self._baseline_done = False
        self._mock_index = 0

    # Subclasses implement these.
    def has_credentials(self) -> bool: ...
    def fetch_live(self) -> list[Item]: ...
    def fetch_mock(self) -> list[Item]: ...

    def run(self) -> None:
        if self.mock:
            log.warning("%s: credentials missing, running in mock mode (simulated items).", self.source)
        while not self.stop_event.is_set():
            try:
                if self.mock:
                    items = self.fetch_mock()
                else:
                    items = self.fetch_live()
                    if not self._baseline_done:
                        # First live poll: remember what is already there without alerting on it.
                        self._seen.update(item.item_id for item in items)
                        self._baseline_done = True
                        items = []
            except requests.RequestException as exc:
                log.warning("%s: request failed: %s", self.source, exc)
                items = []
            except Exception:  # keep the worker alive whatever the API returns
                log.exception("%s: unexpected error while polling", self.source)
                items = []

            for item in items:
                if item.item_id not in self._seen:
                    self._seen.add(item.item_id)
                    self.out.put(item)

            self.stop_event.wait(self.interval)

    def _next_mock(self, messages: list[str]) -> str:
        text = messages[self._mock_index % len(messages)]
        self._mock_index += 1
        return text

    def _mock_item(self, messages: list[str]) -> list[Item]:
        n = self._mock_index + 1
        return [Item(self.source, f"mock-{self.source}-{n}", self._next_mock(messages))]


class GmailWorker(PollingWorker):
    source = "gmail"
    live_interval_s = 60
    API = "https://gmail.googleapis.com/gmail/v1/users/me/messages"

    def has_credentials(self) -> bool:
        return bool(os.getenv("GMAIL_ACCESS_TOKEN"))

    def fetch_mock(self) -> list[Item]:
        return self._mock_item(MOCK_EMAILS)

    def fetch_live(self) -> list[Item]:
        headers = {"Authorization": f"Bearer {os.environ['GMAIL_ACCESS_TOKEN']}"}
        listing = requests.get(
            self.API,
            params={"q": "is:unread in:inbox", "maxResults": 10},
            headers=headers,
            timeout=REQUEST_TIMEOUT,
        )
        listing.raise_for_status()
        items = []
        for ref in listing.json().get("messages", []):
            response = requests.get(
                f"{self.API}/{ref['id']}",
                params=[("format", "metadata"), ("metadataHeaders", "From"), ("metadataHeaders", "Subject")],
                headers=headers,
                timeout=REQUEST_TIMEOUT,
            )
            response.raise_for_status()
            message = response.json()
            header = {h["name"]: h["value"] for h in message.get("payload", {}).get("headers", [])}
            text = (f"Email from {header.get('From', 'unknown')}: "
                    f"{header.get('Subject', '(no subject)')}. {message.get('snippet', '')}")
            items.append(Item(self.source, ref["id"], text))
        return items


class CalendarWorker(PollingWorker):
    source = "calendar"
    live_interval_s = 300
    mock_interval_s = 45
    API = "https://www.googleapis.com/calendar/v3/calendars/primary/events"

    def has_credentials(self) -> bool:
        return bool(os.getenv("GOOGLE_CALENDAR_ACCESS_TOKEN"))

    def fetch_mock(self) -> list[Item]:
        return self._mock_item(MOCK_CALENDAR)

    def fetch_live(self) -> list[Item]:
        now = datetime.now(timezone.utc)
        response = requests.get(
            self.API,
            params={
                "timeMin": now.isoformat(),
                "timeMax": (now + timedelta(days=1)).isoformat(),
                "singleEvents": "true",
                "orderBy": "startTime",
                "maxResults": 10,
            },
            headers={"Authorization": f"Bearer {os.environ['GOOGLE_CALENDAR_ACCESS_TOKEN']}"},
            timeout=REQUEST_TIMEOUT,
        )
        response.raise_for_status()
        items = []
        for event in response.json().get("items", []):
            start = event.get("start", {}).get("dateTime", event.get("start", {}).get("date", ""))
            description = (event.get("description") or "").strip()[:120]
            text = f"Meeting: {event.get('summary', '(untitled)')} at {start}."
            if description:
                text += f" {description}"
            # Changing the event changes its updated stamp, so an edited meeting is seen again.
            items.append(Item(self.source, f"{event['id']}:{event.get('updated', '')}", text))
        return items


class AirtableWorker(PollingWorker):
    source = "airtable"
    live_interval_s = 60
    mock_interval_s = 30

    def has_credentials(self) -> bool:
        return all(os.getenv(name) for name in ("AIRTABLE_API_KEY", "AIRTABLE_BASE_ID", "AIRTABLE_TABLE_NAME"))

    def fetch_mock(self) -> list[Item]:
        return self._mock_item(MOCK_CRM)

    def fetch_live(self) -> list[Item]:
        base = os.environ["AIRTABLE_BASE_ID"]
        table = os.environ["AIRTABLE_TABLE_NAME"]
        response = requests.get(
            f"https://api.airtable.com/v0/{base}/{table}",
            params={"pageSize": 20},
            headers={"Authorization": f"Bearer {os.environ['AIRTABLE_API_KEY']}"},
            timeout=REQUEST_TIMEOUT,
        )
        response.raise_for_status()
        items = []
        for record in response.json().get("records", []):
            fields = record.get("fields", {})
            # Airtable does not expose a change stamp in list results, so a record is
            # "new or changed" when its record id or field contents differ from last time.
            version = hash(tuple(sorted((k, str(v)) for k, v in fields.items())))
            summary = ", ".join(f"{k}: {v}" for k, v in list(fields.items())[:4])
            items.append(Item(self.source, f"{record['id']}:{version}", f"CRM update: {summary}"))
        return items


WORKER_CLASSES: tuple[type[PollingWorker], ...] = (GmailWorker, CalendarWorker, AirtableWorker)


class IntegrationHub:
    """Starts all workers and owns the queue they publish to."""

    def __init__(self) -> None:
        self.queue: queue.Queue[Item] = queue.Queue()
        self._stop = threading.Event()
        self.workers: list[PollingWorker] = [cls(self.queue, self._stop) for cls in WORKER_CLASSES]

    def start(self) -> None:
        for worker in self.workers:
            worker.start()

    def stop(self) -> None:
        self._stop.set()

    def describe(self) -> str:
        return ", ".join(f"{w.source}={'mock' if w.mock else 'live'}" for w in self.workers)
