"""
python manage.py seed_finance_rates

Loads the starter rate table. These are SAMPLE values for the demo only -
replace them with the client's approved rate schedule. Existing codes are
left alone, so running it twice is safe.
"""
from datetime import date

from django.core.management.base import BaseCommand

from finance.models import Rate

SOURCE = "Sample rate - replace with client rate schedule"
RATES = [
    ("RATE-LAB-01", "labour", "General Labourer", "hr", "55"),
    ("RATE-LAB-02", "labour", "Equipment Operator", "hr", "75"),
    ("RATE-LAB-03", "labour", "Journeyperson Electrician", "hr", "95"),
    ("RATE-LAB-04", "labour", "Site Supervisor", "hr", "90"),
    ("RATE-LAB-05", "labour", "Project Manager", "hr", "120"),
    ("RATE-EQP-01", "equipment", "Excavator (20 t)", "day", "1400"),
    ("RATE-EQP-02", "equipment", "Tandem Dump Truck", "hr", "130"),
    ("RATE-EQP-03", "equipment", "Skid Steer Loader", "day", "450"),
    ("RATE-EQP-04", "equipment", "Generator (100 kW)", "day", "350"),
    ("RATE-EQP-05", "equipment", 'Water Pump (4")', "day", "120"),
    ("RATE-MAT-01", "materials", "Gravel / Aggregate", "m3", "45"),
    ("RATE-MAT-02", "materials", "Ready-mix Concrete", "m3", "260"),
    ("RATE-MAT-03", "materials", "Rip-rap", "m3", "90"),
    ("RATE-MAT-04", "materials", "Sandbags (filled)", "each", "4"),
    ("RATE-SUB-01", "subcontractors", "Debris Removal Contractor", "day", "4500"),
    ("RATE-SUB-02", "subcontractors", "Traffic Control Crew", "day", "1800"),
    ("RATE-SUB-03", "subcontractors", "Environmental Assessment", "lump", "15000"),
    ("RATE-FAC-01", "facility_rental", "Site Office Trailer", "mo", "1200"),
    ("RATE-FAC-02", "facility_rental", "Warehouse / Storage Space", "mo", "3500"),
    ("RATE-FAC-03", "facility_rental", "Community Hall (Reception Centre)", "day", "600"),
    ("RATE-FAC-04", "facility_rental", "Portable Toilet Unit", "mo", "250"),
    ("RATE-OVH-01", "overhead", "Project Administration", "mo", "5000"),
]


class Command(BaseCommand):
    help = "Load the SAMPLE starter rate table (safe to run more than once)."

    def handle(self, *args, **options):
        created = 0
        for code, category, resource, unit, rate in RATES:
            _, made = Rate.objects.get_or_create(code=code, defaults=dict(
                category=category, resource=resource, unit=unit, base_rate=rate,
                source=SOURCE, effective_date=date(2026, 1, 1)))
            created += made
        self.stdout.write(self.style.SUCCESS(
                f"Sample rates: {created} added, {len(RATES) - created} already there."))
