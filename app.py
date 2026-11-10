"""Desktop pet prototype: a placeholder sprite that hops between random points on every connected screen.

Run with:  python app.py
"""

import random
import sys
from dataclasses import dataclass

from PyQt6.QtCore import QRect, Qt, QTimer
from PyQt6.QtGui import QColor, QGuiApplication, QPainter
from PyQt6.QtWidgets import QApplication, QWidget

PET_SIZE = 60
MOVE_INTERVAL_MS = 2000


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
    def __init__(self, screen_manager: ScreenManager) -> None:
        super().__init__()
        self.screen_manager = screen_manager

        self.setWindowFlags(
            Qt.WindowType.FramelessWindowHint
            | Qt.WindowType.WindowStaysOnTopHint
            | Qt.WindowType.SubWindow
            | Qt.WindowType.WindowTransparentForInput
        )
        self.setAttribute(Qt.WidgetAttribute.WA_TranslucentBackground, True)
        self.setFixedSize(PET_SIZE, PET_SIZE)

        self.color = QColor(255, 105, 97)  # placeholder colour

        self.timer = QTimer(self)
        self.timer.setInterval(MOVE_INTERVAL_MS)
        self.timer.timeout.connect(self.relocate)

    def start(self) -> None:
        self.relocate()
        self.show()
        self.timer.start()

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
