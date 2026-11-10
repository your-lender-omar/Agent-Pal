"""Desktop pet: a placeholder sprite that hops between random points on every connected screen.

Settings come from config.json (edit them with dashboard.py). The pet checks the file
every half second and applies changes as soon as it is saved.

Run with:  python app.py
"""

import random
import sys
from dataclasses import dataclass

from PyQt6.QtCore import QRect, Qt, QTimer
from PyQt6.QtGui import QColor, QGuiApplication, QPainter
from PyQt6.QtWidgets import QApplication, QWidget

from config_store import CONFIG_PATH, ConfigError, DEFAULT_CONFIG, load_config

PET_SIZE = 60
CONFIG_POLL_MS = 500

# How often the pet wanders on its own. "only_important" has no entry: it only moves when a reminder fires.
FREQUENCY_MOVE_MS = {
    "frequent": 2 * 1000,
    "interval_10min": 10 * 60 * 1000,
}

# Placeholder colours standing in for the real caricature skins.
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


class DesktopPet(QWidget):
    def __init__(self, screen_manager: ScreenManager, config_path=CONFIG_PATH) -> None:
        super().__init__()
        self.screen_manager = screen_manager
        self.config_path = config_path
        self.config: dict | None = None
        self.config_stamp = None
        self.window_interaction = DEFAULT_CONFIG["window_interaction"]

        self.setWindowFlags(
            Qt.WindowType.FramelessWindowHint
            | Qt.WindowType.WindowStaysOnTopHint
            | Qt.WindowType.Tool
            | Qt.WindowType.WindowTransparentForInput
        )
        self.setAttribute(Qt.WidgetAttribute.WA_TranslucentBackground, True)
        self.setFixedSize(PET_SIZE, PET_SIZE)

        self.color = SKIN_COLORS["skin1"]
        self.reminder_timers: list[QTimer] = []

        self.move_timer = QTimer(self)
        self.move_timer.timeout.connect(self.relocate)

        self.config_timer = QTimer(self)
        self.config_timer.setInterval(CONFIG_POLL_MS)
        self.config_timer.timeout.connect(self.check_config)

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

    def apply_settings(self, cfg: dict) -> None:
        skin = cfg["selected_skin"]
        if skin == "RANDOM":
            skin = random.choice(list(SKIN_COLORS))
        self.color = SKIN_COLORS[skin]
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
            f"[config] Applied: skin={cfg['selected_skin']} (showing {skin}), "
            f"frequency={cfg['frequency']}, window_interaction={cfg['window_interaction']}, "
            f"reminders={len(cfg['custom_reminders'])}"
        )

    # ---- behaviour -------------------------------------------------------

    def fire_reminder(self, rule: dict) -> None:
        print(f"[reminder] {rule['name']}: {rule['text']}")
        self.relocate()

    def relocate(self) -> None:
        screen = self.screen_manager.random_screen()
        x, y = self.screen_manager.random_point(screen, PET_SIZE)
        self.move(x, y)
        print(f"Moved to ({x}, {y}) on {screen.name or 'screen'} "
              f"[x={screen.x} y={screen.y} {screen.width}x{screen.height}]")

    def paintEvent(self, event) -> None:  # noqa: N802 (Qt naming)
        painter = QPainter(self)
        painter.setRenderHint(QPainter.RenderHint.Antialiasing)
        painter.setPen(Qt.PenStyle.NoPen)
        painter.setBrush(self.color)
        # Placeholder for the caricature: a circle filling the 60x60 widget.
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
