"""Print the PPOST change log:  python manage.py ppost_log --last 20 [--event EV-2026-014] [--record T-014]"""
from django.core.management.base import BaseCommand
from django.utils import timezone

from ppost.models import PpostChange, PpostRecord


class Command(BaseCommand):
    help = "Show recent PPOST changes (who, when, what) and record counts."

    def add_arguments(self, parser):
        parser.add_argument("--last", type=int, default=20)
        parser.add_argument("--event", default=None)
        parser.add_argument("--record", default=None)

    def handle(self, *args, **opts):
        qs = PpostChange.objects.all()
        recs = PpostRecord.objects.filter(is_deleted=False)
        if opts["event"]:
            qs, recs = qs.filter(event_id=opts["event"]), recs.filter(event_id=opts["event"])
        if opts["record"]:
            qs = qs.filter(record_id=opts["record"])
        counts = {}
        for kind in recs.values_list("kind", flat=True):
            counts[kind] = counts.get(kind, 0) + 1
        self.stdout.write(self.style.MIGRATE_HEADING(f"Saved records: {sum(counts.values())}  {counts}"))
        self.stdout.write(self.style.MIGRATE_HEADING(f"Last {opts['last']} changes (newest first, local time):"))
        for c in qs[: opts["last"]]:
            when = timezone.localtime(c.at).strftime("%Y-%m-%d %H:%M:%S")
            fields = ", ".join(c.changed_fields[:6]) + (" …" if len(c.changed_fields) > 6 else "")
            self.stdout.write(f"{when}  {c.username:<12} {c.action:<8} {c.kind:<10} {c.record_id:<16} v{c.version}  {fields}")
