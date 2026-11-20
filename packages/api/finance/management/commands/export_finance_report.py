"""
python manage.py export_finance_report EV-2026-014 --output finance_report.json

Writes the finance report JSON for one event (format: finance/report_schema.json).
Without --output it prints to the screen.
"""
import json
from pathlib import Path

from django.core.management.base import BaseCommand

from finance.report import build_report


class Command(BaseCommand):
    help = "Export the finance report JSON for one event."

    def add_arguments(self, parser):
        parser.add_argument("event_id", help="e.g. EV-2026-014")
        parser.add_argument("--output", "-o", help="File to write (UTF-8). Prints to the screen if left out.")

    def handle(self, *args, **opts):
        text = json.dumps(build_report(opts["event_id"], generated_by="export_command"), indent=2, ensure_ascii=False)
        if opts["output"]:
            Path(opts["output"]).write_text(text + "\n", encoding="utf-8")
            if opts["verbosity"]:
                self.stdout.write(self.style.SUCCESS(f"Wrote {opts['output']}"))
        else:
            self.stdout.write(text)
