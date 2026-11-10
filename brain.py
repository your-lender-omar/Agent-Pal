"""Text classification brain: learns which keywords matter from the user's feedback.

Weights live in weights.json next to this file. Text is split into keywords, each keyword
contributes its weight to a score, and the text is important when score >= threshold.
  * reward(text):   "Give Food" boosts the weights of the text's keywords.
  * punish(text):   "Spam" lowers them.
Every feedback call saves weights.json immediately.
"""

import json
import os
import re
from dataclasses import dataclass
from pathlib import Path

WEIGHTS_PATH = Path(__file__).resolve().parent / "weights.json"
DEFAULT_THRESHOLD = 0.0
STEP = 0.5            # how far one feedback click moves each keyword
WEIGHT_LIMIT = 5.0    # weights stay within [-WEIGHT_LIMIT, +WEIGHT_LIMIT]
MIN_KEYWORD_LEN = 3

STOPWORDS = frozenset(
    """a about all also and any are as at be been being but by can did do does for from
    had has have he her here his how i if in into is it its just me more most my no not
    of on or our out over she so than that the their them then there these they this to
    too up us was we were what when where which who why will with would you your""".split()
)

_WORD_RE = re.compile(r"[^\W\d_]+")


def extract_keywords(text: str) -> list[str]:
    """Lowercase words with stopwords and very short words removed. Duplicates are dropped, order kept."""
    keywords: list[str] = []
    for word in _WORD_RE.findall(text.lower()):
        if len(word) < MIN_KEYWORD_LEN or word in STOPWORDS or word in keywords:
            continue
        keywords.append(word)
    return keywords


@dataclass(frozen=True)
class Verdict:
    score: float
    keywords: tuple[str, ...]
    important: bool


class Brain:
    def __init__(self, path: Path = WEIGHTS_PATH, threshold: float = DEFAULT_THRESHOLD) -> None:
        self.path = path
        self.threshold = threshold
        self.weights: dict[str, float] = {}

    # ---- persistence -------------------------------------------------------

    @classmethod
    def load(cls, path: Path = WEIGHTS_PATH) -> "Brain":
        brain = cls(path)
        if not path.exists():
            brain.save()
            return brain
        try:
            data = json.loads(path.read_text(encoding="utf-8"))
            brain.threshold = float(data.get("threshold", DEFAULT_THRESHOLD))
            raw = data.get("weights", {})
            brain.weights = {str(k): float(v) for k, v in raw.items()}
        except (OSError, ValueError, TypeError, AttributeError) as exc:
            # Keep the broken file as a backup rather than silently discarding it.
            backup = path.with_name(path.name + ".bak")
            os.replace(path, backup)
            print(f"[brain] weights.json was unreadable ({exc}); moved to {backup.name}, starting fresh.")
            brain.weights = {}
            brain.threshold = DEFAULT_THRESHOLD
            brain.save()
        return brain

    def save(self) -> None:
        payload = {
            "version": 1,
            "threshold": self.threshold,
            "weights": {k: round(v, 3) for k, v in sorted(self.weights.items())},
        }
        tmp_path = self.path.with_name(self.path.name + ".tmp")
        tmp_path.write_text(json.dumps(payload, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
        os.replace(tmp_path, self.path)

    # ---- classification ----------------------------------------------------

    def evaluate(self, text: str) -> Verdict:
        keywords = extract_keywords(text)
        score = sum(self.weights.get(k, 0.0) for k in keywords)
        return Verdict(score=score, keywords=tuple(keywords), important=score >= self.threshold)

    # ---- feedback ----------------------------------------------------------

    def reward(self, text: str) -> list[str]:
        """'Give Food': boost every keyword in text. Returns the keywords that changed."""
        return self._adjust(text, +STEP)

    def punish(self, text: str) -> list[str]:
        """'Spam': lower every keyword in text. Returns the keywords that changed."""
        return self._adjust(text, -STEP)

    def _adjust(self, text: str, delta: float) -> list[str]:
        keywords = extract_keywords(text)
        for keyword in keywords:
            current = self.weights.get(keyword, 0.0)
            self.weights[keyword] = max(-WEIGHT_LIMIT, min(WEIGHT_LIMIT, current + delta))
        if keywords:
            self.save()
        return keywords
