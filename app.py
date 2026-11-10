"""Desktop pet: a sprite that hops between random points on every connected screen.

Settings come from config.json (edit them with dashboard.py). The pet checks the file
every half second and applies changes as soon as it is saved. Reminders play a
presentation from animations.py and show their text in a speech bubble.

Run with:  python app.py
"""

import random
import sys
from dataclasses import dataclass
from pathlib import Path

from PyQt6.QtCore import QPointF, QRect, QRectF, Qt, QTimer
from PyQt6.QtGui import (
    QColor,
    QFontMetrics,
    QGuiApplication,
    QPainter,
    QPainterPath,
    QPen,
    QPixmap,
    QTextOption,
)
from PyQt6.QtWidgets import QApplication, QWidget

from animations import PRESENTATION_MS, PresentationOverlay, random_style
from config_store import CONFIG_PATH, ConfigError, DEFAULT_CONFIG, load_config

ASSETS_DIR = Path(__file__).resolve().parent / "assets" / "skins"

PET_SIZE = 60
CONFIG_POLL_MS = 500
WALK_MS = 800                          # how long walk.png shows after a move
BUBBLE_MS = PRESENTATION_MS + 2500     # speech bubble stays a little after the presentation
BUBBLE_WIDTH = 230
BUBBLE_PAD = 10
BUBBLE_TAIL = 10

# How often the pet wanders on its own. "only_important" has no entry: it only moves when a reminder fires.
FREQUENCY_MOVE_MS = {
    "frequent": 2 * 1000,
    "interval_10min": 10 * 60 * 1000,
}

# Fallback colours, used when a skin folder has no PNGs yet.
SKIN_COLORS = {
    "skin1": QColor(255, 105, 97),
    "skin2": QColor(92, 170, 255),
    "skin3": QColor(120, 200, 120),
    "skin4": QColor(255, 196, 64),
    "skin5": QColor(180, 120, 220),
}


@dataclass(frozen=True)
class ScreenInfo:
    """Snapshot of one monitor, in global (virtual desktop) coordinates."""

    name: str
    geometry: QRect       # full monitor area
    available: QRect      # geometry minus taskbars/docks
    rotation: str         # e.g. "PrimaryOrientation", "PortraitOrientation"
    shape: str            # "landscape" or "portrait", derived from the real width/height

    @property
    def x(self) -> int:
        return self.geometry.x()

    @property
    def y(self) -> int:
        return self.geometry.y()

    @property
    def width(self) -> int:
        return self.geometry.width()

    @property
    def height(self) -> int:
        return self.geometry.height()


class ScreenManager:
    """Maps every connected monitor and picks positions that keep a sprite fully on screen."""

    def __init__(self) -> None:
        self.refresh()

    def refresh(self) -> None:
        """Re-read the screen list. Call again if monitors are plugged or unplugged."""
        self._screens: list[ScreenInfo] = []
        for screen in QGuiApplication.screens():
            geometry = screen.geometry()
            orientation = screen.orientation()
            self._screens.append(
                ScreenInfo(
                    name=screen.name(),
                    geometry=QRect(geometry),
                    available=QRect(screen.availableGeometry()),
                    rotation=orientation.name,
                    # Qt already reports rotated geometry, so width/height reflect the
                    # current orientation. Classify the shape from those values.
                    shape="portrait" if geometry.height() > geometry.width() else "landscape",
                )
            )

    def screens(self) -> list[ScreenInfo]:
        return list(self._screens)

    def random_screen(self) -> ScreenInfo:
        return random.choice(self._screens)

    @staticmethod
    def safe_bounds(screen: ScreenInfo, sprite_size: int) -> QRect:
        """Top-left corners where a sprite of sprite_size fits fully inside the usable area.

        Uses the available geometry (excludes taskbars/docks). Returns a rect whose
        x/y are the valid top-left range; if the sprite is larger than the screen,
        the range collapses to the screen origin.
        """
        area = screen.available
        max_x = max(area.left(), area.right() - sprite_size + 1)
        max_y = max(area.top(), area.bottom() - sprite_size + 1)
        return QRect(area.left(), area.top(), max_x - area.left(), max_y - area.top())

    def random_point(self, screen: ScreenInfo, sprite_size: int) -> tuple[int, int]:
        bounds = self.safe_bounds(screen, sprite_size)
        x = random.randint(bounds.left(), bounds.left() + bounds.width())
        y = random.randint(bounds.top(), bounds.top() + bounds.height())
        return x, y

    def describe(self) -> str:
        lines = [f"Detected {len(self._screens)} screen(s):"]
        for i, s in enumerate(self._screens, start=1):
            g, a = s.geometry, s.available
            lines.append(
                f"  [{i}] {s.name or '(unnamed)'}: "
                f"x={g.x()} y={g.y()} width={g.width()} height={g.height()} "
                f"({s.shape}, rotation={s.rotation})"
            )
            lines.append(
                f"       available: x={a.x()} y={a.y()} "
                f"width={a.width()} height={a.height()}"
            )
            bounds = self.safe_bounds(s, PET_SIZE)
            lines.append(
                f"       sprite top-left range ({PET_SIZE}px): "
                f"x={bounds.left()}..{bounds.left() + bounds.width()} "
                f"y={bounds.top()}..{bounds.top() + bounds.height()}"
            )
        return "\n".join(lines)


def pick_random_skin(assets_dir: Path, rng=random) -> Path:
    """Choose one skin folder from random_pool/. Falls back to skin1-skin5 if the pool is empty."""
    pool_dir = assets_dir / "random_pool"
    pool = sorted(p for p in pool_dir.iterdir() if p.is_dir()) if pool_dir.is_dir() else []
    if not pool:
        pool = [assets_dir / f"skin{i}" for i in range(1, 6)]
    return rng.choice(pool)


class SkinSprites:
    """idle.png and walk.png from one skin folder. A missing file leaves that sprite as None."""

    def __init__(self, folder: Path) -> None:
        self.folder = folder
        self.idle = self._load("idle.png")
        walk = self._load("walk.png")
        self.walk = walk if walk is not None else self.idle

    def _load(self, filename: str) -> QPixmap | None:
        path = self.folder / filename
        if not path.is_file():
            return None
        pixmap = QPixmap(str(path))
        if pixmap.isNull():
            print(f"[skin] Could not read {path}")
            return None
        return pixmap.scaled(
            PET_SIZE, PET_SIZE,
            Qt.AspectRatioMode.KeepAspectRatio,
            Qt.TransformationMode.SmoothTransformation,
        )


class SpeechBubble(QWidget):
    """Transparent speech bubble attached above the pet, or below it when there is no room."""

    def __init__(self, pet: "DesktopPet") -> None:
        super().__init__()
        self.pet = pet
        self.text = ""
        self._below = False
        self._tail_x = BUBBLE_WIDTH // 2
        self.setWindowFlags(
            Qt.WindowType.FramelessWindowHint
            | Qt.WindowType.WindowStaysOnTopHint
            | Qt.WindowType.Tool
            | Qt.WindowType.WindowTransparentForInput
        )
        self.setAttribute(Qt.WidgetAttribute.WA_TranslucentBackground, True)
        self._hide_timer = QTimer(self)
        self._hide_timer.setSingleShot(True)
        self._hide_timer.timeout.connect(self.hide)

    def show_text(self, text: str, duration_ms: int) -> None:
        self.text = text
        metrics = QFontMetrics(self.font())
        text_rect = metrics.boundingRect(
            QRect(0, 0, BUBBLE_WIDTH - 2 * BUBBLE_PAD, 0),
            int(Qt.TextFlag.TextWordWrap),
            text,
        )
        height = max(text_rect.height(), metrics.height()) + 2 * BUBBLE_PAD + BUBBLE_TAIL
        self.setFixedSize(BUBBLE_WIDTH, height)
        self.follow()
        self.show()
        self._hide_timer.start(duration_ms)

    def follow(self) -> None:
        """Move next to the pet. Called whenever the pet moves, and before the bubble is shown."""
        pet_rect = self.pet.geometry()
        centre = pet_rect.center()
        screen = QGuiApplication.screenAt(centre) or QGuiApplication.primaryScreen()
        area = screen.availableGeometry()

        x = centre.x() - self.width() // 2
        x = max(area.left(), min(x, area.right() - self.width() + 1))
        y = pet_rect.top() - self.height() + 1
        self._below = y < area.top()
        if self._below:
            y = pet_rect.bottom() + 1

        self.move(x, y)
        self._tail_x = centre.x() - x
        self.update()

    def paintEvent(self, event) -> None:  # noqa: N802 (Qt naming)
        w, h = self.width(), self.height()
        tail = BUBBLE_TAIL
        body_top = tail if self._below else 0
        body = QRectF(0, body_top, w, h - tail)

        path = QPainterPath()
        path.addRoundedRect(body, 12, 12)
        tx = max(16, min(self._tail_x, w - 16))
        point = QPointF(tx, body.top() - tail if self._below else body.bottom() + tail)
        base_y = body.top() if self._below else body.bottom()
        pointer = QPainterPath()
        pointer.moveTo(tx - 8, base_y)
        pointer.lineTo(point)
        pointer.lineTo(tx + 8, base_y)
        pointer.closeSubpath()
        path.addPath(pointer)

        painter = QPainter(self)
        painter.setRenderHint(QPainter.RenderHint.Antialiasing)
        painter.setPen(QPen(QColor(60, 50, 40), 1.5))
        painter.setBrush(QColor(255, 252, 240, 240))
        painter.drawPath(path)
        painter.setPen(QColor(30, 30, 30))
        option = QTextOption(Qt.AlignmentFlag.AlignCenter)
        option.setWrapMode(QTextOption.WrapMode.WordWrap)
        painter.drawText(body.adjusted(BUBBLE_PAD, BUBBLE_PAD, -BUBBLE_PAD, -BUBBLE_PAD), self.text, option)
        painter.end()


class DesktopPet(QWidget):
    def __init__(self, screen_manager: ScreenManager, config_path: Path = CONFIG_PATH,
                 assets_dir: Path = ASSETS_DIR) -> None:
        super().__init__()
        self.screen_manager = screen_manager
        self.config_path = config_path
        self.assets_dir = assets_dir
        self.config: dict | None = None
        self.config_stamp = None
        self.window_interaction = DEFAULT_CONFIG["window_interaction"]

        # RANDOM is chosen once at boot and kept for the whole session.
        self.random_skin_dir = pick_random_skin(assets_dir)
        print(f"[skin] RANDOM pinned for this session: {self.random_skin_dir.name}")

        self.sprites: SkinSprites | None = None
        self.sprite_cache: dict[Path, SkinSprites] = {}
        self.color = SKIN_COLORS["skin1"]
        self.walking = False
        self.reminder_timers: list[QTimer] = []

        self.setWindowFlags(
            Qt.WindowType.FramelessWindowHint
            | Qt.WindowType.WindowStaysOnTopHint
            | Qt.WindowType.Tool
            | Qt.WindowType.WindowTransparentForInput
        )
        self.setAttribute(Qt.WidgetAttribute.WA_TranslucentBackground, True)
        self.setFixedSize(PET_SIZE, PET_SIZE)

        self.move_timer = QTimer(self)
        self.move_timer.timeout.connect(self.wander)

        self.config_timer = QTimer(self)
        self.config_timer.setInterval(CONFIG_POLL_MS)
        self.config_timer.timeout.connect(self.check_config)

        self.walk_timer = QTimer(self)
        self.walk_timer.setSingleShot(True)
        self.walk_timer.timeout.connect(self._stop_walking)

        self.bubble = SpeechBubble(self)
        self.overlay = PresentationOverlay()
        self.overlay.presentation_finished.connect(self.relocate)

    def start(self) -> None:
        self.load_settings()
        self.config_stamp = self._file_stamp()
        self.relocate()
        self.show()
        self.config_timer.start()

    # ---- config handling -------------------------------------------------

    def _file_stamp(self):
        try:
            st = self.config_path.stat()
        except OSError:
            return None
        return st.st_mtime_ns, st.st_size

    def check_config(self) -> None:
        """Poll config.json and reapply it whenever its modification time or size changes."""
        stamp = self._file_stamp()
        if stamp != self.config_stamp:
            self.config_stamp = stamp
            self.load_settings()

    def load_settings(self) -> None:
        try:
            cfg = load_config(self.config_path)
        except (ConfigError, OSError) as exc:
            print(f"[config] Not applied, keeping current settings: {exc}")
            if self.config is None:
                print("[config] Using built-in defaults.")
                cfg = DEFAULT_CONFIG
            else:
                return
        self.apply_settings(cfg)

    def _sprites_for(self, folder: Path) -> SkinSprites:
        if folder not in self.sprite_cache:
            self.sprite_cache[folder] = SkinSprites(folder)
        return self.sprite_cache[folder]

    def apply_settings(self, cfg: dict) -> None:
        if cfg["selected_skin"] == "RANDOM":
            folder = self.random_skin_dir
        else:
            folder = self.assets_dir / cfg["selected_skin"]
        self.sprites = self._sprites_for(folder)
        self.color = SKIN_COLORS.get(folder.name, SKIN_COLORS["skin1"])
        if self.sprites.idle is None:
            print(f"[skin] No idle.png in {folder}; drawing a placeholder circle.")
        self.window_interaction = cfg["window_interaction"]

        # Wandering: restart the move timer with the new frequency, or stop it.
        self.move_timer.stop()
        move_ms = FREQUENCY_MOVE_MS.get(cfg["frequency"])
        if move_ms is not None:
            self.move_timer.setInterval(move_ms)
            self.move_timer.start()

        # Rules: rebuild one timer per custom reminder.
        for timer in self.reminder_timers:
            timer.stop()
            timer.deleteLater()
        self.reminder_timers = []
        for rule in cfg["custom_reminders"]:
            timer = QTimer(self)
            timer.setInterval(rule["interval_sec"] * 1000)
            timer.timeout.connect(lambda r=rule: self.fire_reminder(r))
            timer.start()
            self.reminder_timers.append(timer)

        self.config = cfg
        self.update()
        print(
            f"[config] Applied: skin={cfg['selected_skin']} (folder {folder.name}), "
            f"frequency={cfg['frequency']}, window_interaction={cfg['window_interaction']}, "
            f"reminders={len(cfg['custom_reminders'])}"
        )

    # ---- behaviour -------------------------------------------------------

    def wander(self) -> None:
        """Timer slot for random moves. Skipped while a presentation is playing."""
        if not self.overlay.is_playing():
            self.relocate()

    def fire_reminder(self, rule: dict) -> None:
        print(f"[reminder] {rule['name']}: {rule['text']}")
        style = random_style()
        print(f"[presentation] {style.name}")
        screen = QGuiApplication.screenAt(self.geometry().center()) or QGuiApplication.primaryScreen()
        self.bubble.show_text(rule["text"], BUBBLE_MS)
        self.overlay.play(style, screen.geometry(), QPointF(self.geometry().center()), rule["text"])

    def relocate(self) -> None:
        screen = self.screen_manager.random_screen()
        x, y = self.screen_manager.random_point(screen, PET_SIZE)
        self.move(x, y)
        self.bubble.follow()
        self.walking = True
        self.walk_timer.start(WALK_MS)
        self.update()
        print(f"Moved to ({x}, {y}) on {screen.name or 'screen'} "
              f"[x={screen.x} y={screen.y} {screen.width}x{screen.height}]")

    def _stop_walking(self) -> None:
        self.walking = False
        self.update()

    def paintEvent(self, event) -> None:  # noqa: N802 (Qt naming)
        painter = QPainter(self)
        painter.setRenderHint(QPainter.RenderHint.Antialiasing)
        pixmap = None
        if self.sprites is not None:
            pixmap = self.sprites.walk if self.walking else self.sprites.idle
        if pixmap is not None:
            painter.drawPixmap((PET_SIZE - pixmap.width()) // 2, (PET_SIZE - pixmap.height()) // 2, pixmap)
        else:
            painter.setPen(Qt.PenStyle.NoPen)
            painter.setBrush(self.color)
            painter.drawEllipse(0, 0, PET_SIZE, PET_SIZE)
        painter.end()


def main() -> int:
    app = QApplication(sys.argv)

    screen_manager = ScreenManager()
    print(screen_manager.describe())

    pet = DesktopPet(screen_manager)
    pet.start()

    return app.exec()


if __name__ == "__main__":
    sys.exit(main())
