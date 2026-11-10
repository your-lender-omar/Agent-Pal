"""Settings dashboard for the desktop pet. Reads and writes config.json.

Run with:  python dashboard.py
The pet (app.py) picks up saved changes automatically.
"""

import sys
from copy import deepcopy
from datetime import datetime

from PyQt6.QtWidgets import (
    QApplication,
    QButtonGroup,
    QCheckBox,
    QComboBox,
    QDialog,
    QDialogButtonBox,
    QFormLayout,
    QGroupBox,
    QHBoxLayout,
    QLabel,
    QLineEdit,
    QListWidget,
    QMessageBox,
    QPushButton,
    QRadioButton,
    QSpinBox,
    QVBoxLayout,
    QWidget,
)

from config_store import (
    CONFIG_PATH,
    DEFAULT_CONFIG,
    FREQUENCIES,
    SKINS,
    ConfigError,
    load_config,
    save_config,
)

FREQUENCY_LABELS = {
    "frequent": "Frequent (wanders every 2 seconds)",
    "interval_10min": "Every 10 minutes",
    "only_important": "Only important (moves only when a reminder fires)",
}

SKIN_LABELS = {
    "skin1": "Skin 1",
    "skin2": "Skin 2",
    "skin3": "Skin 3",
    "skin4": "Skin 4",
    "skin5": "Skin 5",
    "RANDOM": "Random",
}


def describe_rule(rule: dict) -> str:
    minutes = rule["interval_sec"] / 60
    return f"{rule['name']}  •  every {minutes:g} min  •  {rule['text']}"


class RuleDialog(QDialog):
    """Small form for entering a new reminder rule."""

    def __init__(self, parent=None) -> None:
        super().__init__(parent)
        self.setWindowTitle("Add Rule")

        self.name_edit = QLineEdit()
        self.name_edit.setPlaceholderText("e.g. Stretch break")
        self.text_edit = QLineEdit()
        self.text_edit.setPlaceholderText("What the pet says when it fires")
        self.minutes_spin = QSpinBox()
        self.minutes_spin.setRange(1, 24 * 60)
        self.minutes_spin.setValue(15)
        self.minutes_spin.setSuffix(" min")

        form = QFormLayout()
        form.addRow("Name:", self.name_edit)
        form.addRow("Message:", self.text_edit)
        form.addRow("Interval:", self.minutes_spin)

        buttons = QDialogButtonBox(
            QDialogButtonBox.StandardButton.Ok | QDialogButtonBox.StandardButton.Cancel
        )
        buttons.accepted.connect(self._try_accept)
        buttons.rejected.connect(self.reject)

        layout = QVBoxLayout(self)
        layout.addLayout(form)
        layout.addWidget(buttons)

    def _try_accept(self) -> None:
        if not self.name_edit.text().strip() or not self.text_edit.text().strip():
            QMessageBox.warning(self, "Add Rule", "Please enter both a name and a message.")
            return
        self.accept()

    def result_rule(self) -> dict:
        return {
            "name": self.name_edit.text().strip(),
            "interval_sec": self.minutes_spin.value() * 60,
            "text": self.text_edit.text().strip(),
        }


class Dashboard(QWidget):
    def __init__(self, config_path=CONFIG_PATH) -> None:
        super().__init__()
        self.config_path = config_path
        self.setWindowTitle("Desktop Pet Settings")
        self.resize(500, 600)

        self.reminders: list[dict] = []
        self._build_ui()
        self._load_into_widgets(self._read_config())

    # ---- UI construction -------------------------------------------------

    def _build_ui(self) -> None:
        # Skin
        self.skin_combo = QComboBox()
        for key in SKINS:
            self.skin_combo.addItem(SKIN_LABELS[key], key)
        skin_box = QGroupBox("Character")
        skin_form = QFormLayout(skin_box)
        skin_form.addRow("Skin:", self.skin_combo)

        # Frequency
        self.frequency_buttons: dict[str, QRadioButton] = {}
        self.frequency_group = QButtonGroup(self)
        freq_box = QGroupBox("Notification frequency")
        freq_layout = QVBoxLayout(freq_box)
        for key in FREQUENCIES:
            button = QRadioButton(FREQUENCY_LABELS[key])
            self.frequency_buttons[key] = button
            self.frequency_group.addButton(button)
            freq_layout.addWidget(button)

        # Behaviour
        self.window_check = QCheckBox("Window Interaction Mode")
        self.window_check.setToolTip(
            "Lets the pet react to open window edges. The setting is saved now; "
            "the window-boundary behaviour is not built yet."
        )
        behaviour_box = QGroupBox("Behaviour")
        behaviour_layout = QVBoxLayout(behaviour_box)
        behaviour_layout.addWidget(self.window_check)

        # Reminders
        self.rule_list = QListWidget()
        add_button = QPushButton("Add Rule…")
        add_button.clicked.connect(self.add_rule)
        delete_button = QPushButton("Delete Selected")
        delete_button.clicked.connect(self.delete_rule)
        rule_buttons = QHBoxLayout()
        rule_buttons.addWidget(add_button)
        rule_buttons.addWidget(delete_button)
        rule_buttons.addStretch(1)
        rules_box = QGroupBox("Active reminders")
        rules_layout = QVBoxLayout(rules_box)
        rules_layout.addWidget(self.rule_list)
        rules_layout.addLayout(rule_buttons)

        # Footer
        self.status_label = QLabel()
        save_button = QPushButton("Save")
        save_button.setDefault(True)
        save_button.clicked.connect(self.save)
        footer = QHBoxLayout()
        footer.addWidget(self.status_label, 1)
        footer.addWidget(save_button)

        layout = QVBoxLayout(self)
        layout.addWidget(skin_box)
        layout.addWidget(freq_box)
        layout.addWidget(behaviour_box)
        layout.addWidget(rules_box, 1)
        layout.addLayout(footer)

    # ---- config <-> widgets ----------------------------------------------

    def _read_config(self) -> dict:
        try:
            return load_config(self.config_path)
        except (ConfigError, OSError) as exc:
            QMessageBox.warning(
                self,
                "Config problem",
                f"Could not read config.json, so default settings are shown.\n\n{exc}\n\n"
                "Saving will overwrite the file.",
            )
            return deepcopy(DEFAULT_CONFIG)

    def _load_into_widgets(self, cfg: dict) -> None:
        self.skin_combo.setCurrentIndex(self.skin_combo.findData(cfg["selected_skin"]))
        self.frequency_buttons[cfg["frequency"]].setChecked(True)
        self.window_check.setChecked(cfg["window_interaction"])
        self.reminders = deepcopy(cfg["custom_reminders"])
        self._refresh_rule_list()
        self.status_label.setText(f"Loaded {self.config_path.name}")

    def _refresh_rule_list(self) -> None:
        self.rule_list.clear()
        for rule in self.reminders:
            self.rule_list.addItem(describe_rule(rule))

    def _collect(self) -> dict:
        checked = self.frequency_group.checkedButton()
        frequency = next(key for key, btn in self.frequency_buttons.items() if btn is checked)
        return {
            "frequency": frequency,
            "window_interaction": self.window_check.isChecked(),
            "selected_skin": self.skin_combo.currentData(),
            "custom_reminders": deepcopy(self.reminders),
        }

    # ---- actions ---------------------------------------------------------

    def add_rule(self) -> None:
        dialog = RuleDialog(self)
        if dialog.exec() == QDialog.DialogCode.Accepted:
            self.reminders.append(dialog.result_rule())
            self._refresh_rule_list()
            self.status_label.setText("Rule added (not saved yet)")

    def delete_rule(self) -> None:
        row = self.rule_list.currentRow()
        if row < 0:
            return
        del self.reminders[row]
        self._refresh_rule_list()
        self.status_label.setText("Rule removed (not saved yet)")

    def save(self) -> None:
        try:
            save_config(self._collect(), self.config_path)
        except (ConfigError, OSError) as exc:
            QMessageBox.critical(self, "Save failed", str(exc))
            return
        self.status_label.setText(f"Saved to {self.config_path.name} at {datetime.now():%H:%M:%S}")


def main() -> int:
    app = QApplication(sys.argv)
    window = Dashboard()
    window.show()
    return app.exec()


if __name__ == "__main__":
    sys.exit(main())
