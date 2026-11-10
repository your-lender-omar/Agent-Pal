"""Notification presentation engine.

A presentation is built from three pluggable parts, combined by a strategy object:

  * EntryVector: how the tool travels from off-screen (or the pet's pocket) to the pet.
  * ToolGraphic: what gets drawn. These are procedural placeholders; real art can replace them later.
  * ExitPhysics: how the tool leaves again.

PresentationStyle is the strategy that combines the three. Categories (Mechanical, Aviation,
Magical) group styles. PresentationOverlay plays one style over the pet's screen, driven by a
QVariantAnimation.

To add a style, pick or write one entry vector, one tool and one exit physics, then list the
combination in a category. Nothing else needs to change.
"""

import math
import random
from abc import ABC, abstractmethod
from dataclasses import dataclass

from PyQt6.QtCore import (
    QAbstractAnimation,
    QPointF,
    QRect,
    QRectF,
    Qt,
    QVariantAnimation,
    pyqtSignal,
)
from PyQt6.QtGui import QColor, QFont, QPainter, QPainterPath, QPen, QPolygonF, QTextOption
from PyQt6.QtWidgets import QWidget

PRESENTATION_MS = 4000
ENTRY_END = 0.35    # fraction of the presentation spent arriving
EXIT_START = 0.75   # fraction at which leaving begins; the tool holds in between

INK = QColor(40, 36, 32)


# ---- shared data -----------------------------------------------------------


@dataclass
class ToolState:
    """Where and how a tool is drawn at one instant. Coordinates are overlay pixels."""

    pos: QPointF
    rotation: float = 0.0   # degrees
    scale: float = 1.0
    opacity: float = 1.0
    progress: float = 1.0   # per-tool 0..1 (unrolling, growing, retracting)
    phase: str = "hold"     # "entry" | "hold" | "exit"
    text: str = ""


@dataclass(frozen=True)
class PresentationContext:
    anchor: QPointF   # where the tool settles, above the pet
    pocket: QPointF   # the pet's pocket, where pocket-style tools come from
    bounds: QRectF    # the whole screen, in overlay coordinates
    text: str


def clamp01(t: float) -> float:
    return max(0.0, min(1.0, t))


def ease_out_cubic(t: float) -> float:
    return 1.0 - (1.0 - t) ** 3


def lerp_point(a: QPointF, b: QPointF, t: float) -> QPointF:
    return QPointF(a.x() + (b.x() - a.x()) * t, a.y() + (b.y() - a.y()) * t)


# ---- entry vectors ---------------------------------------------------------


class EntryVector(ABC):
    """Maps entry progress t (0..1) to the tool's state while it arrives."""

    @abstractmethod
    def state(self, t: float, ctx: PresentationContext) -> ToolState: ...


class DropFromTop(EntryVector):
    """Falls in from above the top of the screen. Optionally bounces when it lands."""

    def __init__(self, bounce: bool = False) -> None:
        self.bounce = bounce

    def state(self, t, ctx):
        start = QPointF(ctx.anchor.x(), ctx.bounds.top() - 120)
        e = ease_out_cubic(t)
        if self.bounce:
            e = 1.0 - math.exp(-6.0 * t) * math.cos(10.0 * t)  # overshoots, then settles
        return ToolState(pos=lerp_point(start, ctx.anchor, e))


class RopeSwing(EntryVector):
    """Dragged in from a screen edge on a rope, swinging as it travels."""

    def __init__(self, side: str = "left") -> None:
        self.side = side

    def state(self, t, ctx):
        x0 = ctx.bounds.left() - 150 if self.side == "left" else ctx.bounds.right() + 150
        start = QPointF(x0, ctx.anchor.y() - 40)
        pos = lerp_point(start, ctx.anchor, ease_out_cubic(t))
        pos.setY(pos.y() - 40.0 * math.sin(math.pi * t))
        sway = 12.0 * math.sin(2.0 * math.pi * t) * (1.0 - t)
        return ToolState(pos=pos, rotation=sway)


class ArcFly(EntryVector):
    """Flies in from the left along a shallow arc."""

    def state(self, t, ctx):
        start = QPointF(ctx.bounds.left() - 160, ctx.anchor.y() - 110)
        pos = lerp_point(start, ctx.anchor, t)
        pos.setY(pos.y() - 50.0 * math.sin(math.pi * t))
        return ToolState(pos=pos, rotation=8.0 * math.sin(math.pi * t))


class PocketPop(EntryVector):
    """Grows out of the pet's pocket and travels to the anchor."""

    def state(self, t, ctx):
        e = ease_out_cubic(t)
        return ToolState(
            pos=lerp_point(ctx.pocket, ctx.anchor, e),
            scale=0.1 + 0.9 * e,
            opacity=clamp01(t * 3),
        )


class OpenInPlace(EntryVector):
    """Appears at the anchor and grows from nothing."""

    def state(self, t, ctx):
        e = ease_out_cubic(t)
        return ToolState(pos=QPointF(ctx.anchor), scale=0.05 + 0.95 * e, opacity=clamp01(t * 2))


class Stationary(EntryVector):
    """Already in place. The tool uses `progress` to grow itself."""

    def state(self, t, ctx):
        return ToolState(pos=QPointF(ctx.anchor))


# ---- exit physics ----------------------------------------------------------


class ExitPhysics(ABC):
    """Maps exit progress t (0..1) to the tool's state while it leaves."""

    @abstractmethod
    def state(self, t: float, ctx: PresentationContext) -> ToolState: ...


class FallAndFade(ExitPhysics):
    def state(self, t, ctx):
        pos = QPointF(ctx.anchor.x(), ctx.anchor.y() + 900.0 * t * t)
        return ToolState(pos=pos, rotation=70.0 * t * t, opacity=1.0 - t)


class FlyAway(ExitPhysics):
    def __init__(self, direction: int = 1) -> None:
        self.direction = direction

    def state(self, t, ctx):
        pos = QPointF(ctx.anchor.x() + self.direction * 1100.0 * t * t, ctx.anchor.y() - 80.0 * t)
        return ToolState(pos=pos, opacity=1.0 - t)


class ShrinkAway(ExitPhysics):
    def state(self, t, ctx):
        return ToolState(pos=QPointF(ctx.anchor), scale=1.0 - t, opacity=1.0 - t)


class Ascend(ExitPhysics):
    def state(self, t, ctx):
        return ToolState(pos=QPointF(ctx.anchor.x(), ctx.anchor.y() - 1000.0 * t * t), opacity=1.0 - t)


class FadeOut(ExitPhysics):
    def state(self, t, ctx):
        return ToolState(pos=QPointF(ctx.anchor), opacity=1.0 - t)


# ---- tool graphics ---------------------------------------------------------


def draw_text(p: QPainter, rect: QRectF, text: str, color: QColor = INK) -> None:
    if not text:
        return
    font = QFont()
    font.setPointSize(9)
    font.setBold(True)
    p.setFont(font)
    p.setPen(color)
    option = QTextOption(Qt.AlignmentFlag.AlignCenter)
    option.setWrapMode(QTextOption.WrapMode.WordWrap)
    p.drawText(rect, text, option)


def draw_banner(p: QPainter, rect: QRectF, text: str,
                fill: QColor = QColor(255, 248, 220), ink: QColor = INK) -> None:
    p.setPen(QPen(QColor(90, 70, 40), 1.5))
    p.setBrush(fill)
    p.drawRoundedRect(rect, 6, 6)
    draw_text(p, rect.adjusted(4, 2, -4, -2), text, ink)


class ToolGraphic(ABC):
    """Draws one tool centred on ToolState.pos. Subclasses implement paint() only."""

    def draw(self, p: QPainter, s: ToolState) -> None:
        p.save()
        p.translate(s.pos)
        p.rotate(s.rotation)
        p.scale(max(0.01, s.scale), max(0.01, s.scale))
        p.setOpacity(clamp01(s.opacity))
        self.paint(p, s)
        p.restore()

    @abstractmethod
    def paint(self, p: QPainter, s: ToolState) -> None: ...


class SandwichBoardTool(ToolGraphic):
    def paint(self, p, s):
        p.setPen(QPen(QColor(120, 90, 60), 2))
        p.drawLine(QPointF(-22, -75), QPointF(-22, -40))
        p.drawLine(QPointF(22, -75), QPointF(22, -40))
        p.setPen(QPen(QColor(70, 50, 30), 2))
        p.setBrush(QColor(196, 150, 96))
        p.drawRect(QRectF(-40, -40, 80, 90))
        draw_text(p, QRectF(-36, -34, 72, 78), s.text)


class BillboardTool(ToolGraphic):
    def paint(self, p, s):
        p.setPen(QPen(QColor(90, 90, 90), 4))
        p.drawLine(QPointF(-40, 30), QPointF(-46, 62))
        p.drawLine(QPointF(40, 30), QPointF(46, 62))
        draw_banner(p, QRectF(-70, -40, 140, 70), s.text,
                    fill=QColor(18, 38, 84), ink=QColor(160, 255, 200))


class ProjectionScreenTool(ToolGraphic):
    """A wall screen that unrolls downward with progress."""

    def paint(self, p, s):
        height = 110.0 * clamp01(s.progress)
        p.setPen(QPen(QColor(60, 60, 60), 2))
        p.setBrush(QColor(70, 70, 70))
        p.drawRect(QRectF(-62, -84, 124, 8))
        p.setBrush(QColor(248, 248, 244))
        p.drawRect(QRectF(-56, -76, 112, height))
        if s.progress > 0.9:
            draw_text(p, QRectF(-50, -70, 100, height - 12), s.text)


class ParachuteTool(ToolGraphic):
    def paint(self, p, s):
        canopy = QPainterPath()
        canopy.moveTo(-52, -30)
        canopy.cubicTo(-52, -100, 52, -100, 52, -30)
        canopy.quadTo(0, -18, -52, -30)
        p.setPen(QPen(QColor(120, 30, 30), 1.5))
        p.setBrush(QColor(220, 60, 60))
        p.drawPath(canopy)
        p.setPen(QPen(QColor(60, 60, 60), 1))
        for x in (-52, -18, 18, 52):
            p.drawLine(QPointF(x, -30), QPointF(0, 0))
        p.setBrush(QColor(150, 110, 70))
        p.drawRect(QRectF(-12, 0, 24, 12))
        p.drawLine(QPointF(0, 12), QPointF(0, 28))
        draw_banner(p, QRectF(-62, 28, 124, 26), s.text)


class BiplaneTool(ToolGraphic):
    def paint(self, p, s):
        # Streamer ribbon that flutters behind the plane, then the banner it trails.
        streamer = QPainterPath()
        streamer.moveTo(-34, 0)
        for i in range(1, 9):
            streamer.lineTo(-34 - i * 4, 5.0 * math.sin(i * 0.9 + s.progress * 6.0))
        p.setPen(QPen(QColor(230, 80, 60), 4))
        p.drawPath(streamer)
        draw_banner(p, QRectF(-178, -12, 110, 24), s.text, fill=QColor(255, 240, 200))

        p.setPen(QPen(QColor(70, 70, 80), 1.5))
        p.setBrush(QColor(120, 160, 210))
        p.drawEllipse(QRectF(-34, -8, 68, 16))
        p.setBrush(QColor(230, 200, 90))
        p.drawRoundedRect(QRectF(-14, -22, 30, 7), 2, 2)
        p.drawRoundedRect(QRectF(-14, 15, 30, 7), 2, 2)
        p.setBrush(QColor(200, 60, 60))
        p.drawPolygon(QPolygonF([QPointF(-30, -4), QPointF(-42, -14), QPointF(-38, 2)]))
        p.drawLine(QPointF(34, -12), QPointF(34, 12))


class RocketTool(ToolGraphic):
    def paint(self, p, s):
        if s.phase in ("entry", "exit"):  # exhaust flame while landing or taking off
            flame = QPolygonF([QPointF(-7, 28), QPointF(7, 28), QPointF(0, 42)])
            p.setPen(Qt.PenStyle.NoPen)
            p.setBrush(QColor(255, 150, 40))
            p.drawPolygon(flame)
        body = QPainterPath()
        body.moveTo(-13, -40)
        body.lineTo(0, -68)
        body.lineTo(13, -40)
        body.lineTo(13, 28)
        body.lineTo(-13, 28)
        body.closeSubpath()
        p.setPen(QPen(INK, 1.5))
        p.setBrush(QColor(235, 235, 240))
        p.drawPath(body)
        p.setBrush(QColor(90, 140, 220))
        p.drawEllipse(QPointF(0, -18), 6, 6)
        p.setBrush(QColor(200, 60, 60))
        p.drawPolygon(QPolygonF([QPointF(-13, 6), QPointF(-26, 26), QPointF(-13, 28)]))
        p.drawPolygon(QPolygonF([QPointF(13, 6), QPointF(26, 26), QPointF(13, 28)]))
        draw_banner(p, QRectF(-50, 46, 100, 22), s.text)


class ScrollTool(ToolGraphic):
    """Parchment that unrolls with progress and rolls up again on exit."""

    def paint(self, p, s):
        width = 40.0 + 150.0 * clamp01(s.progress)
        p.setPen(QPen(QColor(120, 90, 50), 1.5))
        p.setBrush(QColor(240, 226, 180))
        p.drawRect(QRectF(-width / 2, -32, width, 64))
        p.setBrush(QColor(200, 170, 110))
        for x in (-width / 2, width / 2):
            p.drawRoundedRect(QRectF(x - 7, -36, 14, 72), 6, 6)
        if s.progress > 0.7:
            draw_text(p, QRectF(-width / 2 + 12, -28, width - 24, 56), s.text, QColor(70, 40, 20))


class BeanstalkTool(ToolGraphic):
    """A stalk that grows upward with progress, with a sign at the top once fully grown."""

    def paint(self, p, s):
        grow = clamp01(s.progress)
        top = 60.0 - 180.0 * grow
        p.setPen(QPen(QColor(60, 120, 50), 5))
        p.drawLine(QPointF(0, 60), QPointF(0, top))
        p.setPen(Qt.PenStyle.NoPen)
        p.setBrush(QColor(90, 170, 70))
        for i, y in enumerate(range(50, int(top), -28)):
            side = -1 if i % 2 else 1
            p.drawEllipse(QPointF(side * 14, y), 12, 6)
        if grow > 0.95:
            draw_banner(p, QRectF(-55, top - 30, 110, 24), s.text)


class PortalTool(ToolGraphic):
    """A swirling portal with a smoke rim along its base."""

    def paint(self, p, s):
        p.setPen(Qt.PenStyle.NoPen)
        p.setBrush(QColor(160, 160, 170, 120))
        for dx in (-30, -10, 15, 35):
            p.drawEllipse(QPointF(dx, 70), 12, 8)
        p.setBrush(QColor(120, 60, 200, 90))
        p.drawEllipse(QRectF(-45, -70, 90, 140))
        p.setBrush(QColor(60, 180, 220, 140))
        p.drawEllipse(QRectF(-36, -62, 72, 124))
        p.setBrush(QColor(20, 20, 40, 220))
        p.drawEllipse(QRectF(-25, -52, 50, 104))
        p.setPen(QPen(QColor(170, 90, 255), 4))
        p.setBrush(Qt.BrushStyle.NoBrush)
        p.drawEllipse(QRectF(-45, -70, 90, 140))


# ---- strategy ----------------------------------------------------------------


@dataclass
class PresentationStyle:
    """Strategy: one entry vector, one tool graphic and one exit physics."""

    name: str
    entry: EntryVector
    tool: ToolGraphic
    exit: ExitPhysics

    def state_at(self, e: float, ctx: PresentationContext) -> ToolState:
        """State for overall progress e (0..1 across the whole presentation)."""
        e = clamp01(e)
        if e < ENTRY_END:
            t = e / ENTRY_END
            s = self.entry.state(t, ctx)
            s.phase, s.progress = "entry", t
        elif e < EXIT_START:
            s = ToolState(pos=QPointF(ctx.anchor), phase="hold", progress=1.0)
        else:
            t = (e - EXIT_START) / (1.0 - EXIT_START)
            s = self.exit.state(t, ctx)
            s.phase, s.progress = "exit", 1.0 - t
        s.text = ctx.text
        return s


# ---- categories --------------------------------------------------------------


class PresentationCategory(ABC):
    name: str = ""

    @abstractmethod
    def styles(self) -> list[PresentationStyle]: ...


class MechanicalPresentation(PresentationCategory):
    name = "Mechanical"

    def styles(self):
        return [
            PresentationStyle("Sandwich board on a rope", RopeSwing("left"), SandwichBoardTool(), FallAndFade()),
            PresentationStyle("Electronic billboard drop", DropFromTop(bounce=True), BillboardTool(), ShrinkAway()),
            PresentationStyle("Projection screen slide", DropFromTop(), ProjectionScreenTool(), FadeOut()),
        ]


class AviationPresentation(PresentationCategory):
    name = "Aviation"

    def styles(self):
        return [
            PresentationStyle("Parachute with banner", DropFromTop(), ParachuteTool(), FallAndFade()),
            PresentationStyle("Biplane with streamer", ArcFly(), BiplaneTool(), FlyAway(1)),
            PresentationStyle("Rocket capsule landing", DropFromTop(), RocketTool(), Ascend()),
        ]


class MagicalPresentation(PresentationCategory):
    name = "Magical"

    def styles(self):
        return [
            PresentationStyle("Scroll from a tiny pocket", PocketPop(), ScrollTool(), ShrinkAway()),
            PresentationStyle("Growing beanstalk", Stationary(), BeanstalkTool(), ShrinkAway()),
            PresentationStyle("Smoking portal", OpenInPlace(), PortalTool(), ShrinkAway()),
        ]


CATEGORIES: tuple[PresentationCategory, ...] = (
    MechanicalPresentation(),
    AviationPresentation(),
    MagicalPresentation(),
)


def all_styles() -> list[PresentationStyle]:
    return [style for category in CATEGORIES for style in category.styles()]


def random_style(rng=random) -> PresentationStyle:
    return rng.choice(all_styles())


# ---- playback ----------------------------------------------------------------


class PresentationOverlay(QWidget):
    """Transparent window covering one screen. It plays a presentation over the pet."""

    presentation_finished = pyqtSignal()

    def __init__(self) -> None:
        super().__init__()
        self.setWindowFlags(
            Qt.WindowType.FramelessWindowHint
            | Qt.WindowType.WindowStaysOnTopHint
            | Qt.WindowType.Tool
            | Qt.WindowType.WindowTransparentForInput
        )
        self.setAttribute(Qt.WidgetAttribute.WA_TranslucentBackground, True)

        self._style: PresentationStyle | None = None
        self._ctx: PresentationContext | None = None
        self._state: ToolState | None = None

        self._anim = QVariantAnimation(self)
        self._anim.setStartValue(0.0)
        self._anim.setEndValue(1.0)
        self._anim.setDuration(PRESENTATION_MS)
        self._anim.valueChanged.connect(self._on_value)
        self._anim.finished.connect(self._on_finished)

    def is_playing(self) -> bool:
        return self._anim.state() == QAbstractAnimation.State.Running

    def play(self, style: PresentationStyle, screen: QRect, pet_centre: QPointF,
             text: str, duration_ms: int = PRESENTATION_MS) -> None:
        self._anim.stop()
        self.setGeometry(screen)
        local = QPointF(pet_centre.x() - screen.x(), pet_centre.y() - screen.y())
        self._style = style
        self._ctx = PresentationContext(
            anchor=QPointF(local.x(), local.y() - 100),
            pocket=QPointF(local.x() + 45, local.y() + 30),
            bounds=QRectF(0, 0, screen.width(), screen.height()),
            text=text,
        )
        self._anim.setDuration(duration_ms)
        self.show()
        self.raise_()
        self._anim.start()

    def _on_value(self, value) -> None:
        self._state = self._style.state_at(float(value), self._ctx)
        self.update()

    def _on_finished(self) -> None:
        self._state = None
        self._style = None
        self.hide()
        self.presentation_finished.emit()

    def paintEvent(self, event) -> None:  # noqa: N802 (Qt naming)
        if self._state is None or self._style is None:
            return
        p = QPainter(self)
        p.setRenderHint(QPainter.RenderHint.Antialiasing)
        self._style.tool.draw(p, self._state)
        p.end()
