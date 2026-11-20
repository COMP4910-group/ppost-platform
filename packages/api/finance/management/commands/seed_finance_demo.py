"""
python manage.py seed_finance_demo

Fills the finance tables with SYNTHETIC demo data for Clearwater Ridge Wildfire
(EV-2026-014): 3 tactic estimates (one revised and approved), funding sources,
a funding mix, a request letter, spending/claim entries and assistance.
Every step is written to the finance change log, so the report's cost history
works. Does nothing if the event already has finance estimates.

Uses two demo accounts with no password (they can't log in):
demo_preparer (prepares estimates) and demo_reviewer (approves them).
"""
from datetime import date

from django.contrib.auth.models import User
from django.core.management import call_command
from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils import timezone

from finance.audit import record_change, snapshot
from finance.models import (AssistanceItem, BasisOfEstimate, CostLine, Estimate, FinancialEntry, FundingMix,
                            FundingRequest, FundingSource, Rate)

EV = "EV-2026-014"


def demo_user(username):
    user, made = User.objects.get_or_create(username=username)
    if made:
        user.set_unusable_password()
        user.save()
    return user


class Command(BaseCommand):
    help = "Load SYNTHETIC finance demo data for EV-2026-014 (skips if data already exists)."

    def handle(self, *args, **options):
        if Estimate.objects.filter(event_id=EV).exists():
            if options["verbosity"]:
                self.stdout.write(self.style.WARNING(f"{EV} already has finance estimates - nothing added."))
            return
        call_command("seed_finance_rates", verbosity=0)
        with transaction.atomic():
            self.seed()
        if options["verbosity"]:
            self.stdout.write(self.style.SUCCESS(f"Synthetic finance demo data added for {EV}."))

    # ── helpers ──────────────────────────────────────────────────────────────
    def add_lines(self, est, rows):
        for i, r in enumerate(rows, start=1):
            if "rate" in r:
                rate = Rate.objects.get(code=r.pop("rate"))
                r = dict(description=rate.resource, unit=rate.unit, unit_rate=rate.effective_rate, rate=rate, **r)
            CostLine.objects.create(estimate=est, position=i, **r)
        est.recalculate()

    def estimate(self, tactic, rev, title, rows, basis, reason, supersedes=None):
        est = Estimate.objects.create(event_id=EV, tactic_id=tactic, revision=rev, title=title,
                                      prepared_by=self.prep, prepared_date=date(2026, 11, 17),
                                      supersedes=supersedes, created_by=self.prep, updated_by=self.prep)
        self.add_lines(est, rows)
        BasisOfEstimate.objects.create(estimate=est, **basis)
        record_change(est, "create", self.prep, reason=reason)
        return est

    def set_status(self, est, status, user, reason, **extra):
        before = snapshot(est)
        est.status = status
        for k, v in extra.items():
            setattr(est, k, v)
        est.updated_by = user
        est.save()
        record_change(est, "archive" if status == "archived" else "update", user, before=before, reason=reason)

    # ── data ─────────────────────────────────────────────────────────────────
    def seed(self):
        self.prep, self.rev = demo_user("demo_preparer"), demo_user("demo_reviewer")
        pct = lambda cat, p, notes="": dict(description=cat.replace("_", " ").title(), category=cat,
                                            pricing="percent", percent=p, notes=notes)

        # T-014: first estimate, then a revised one that gets approved
        v10 = self.estimate("T-014", "1.0", "Debris removal - Highway 5, km 12-18", [
            dict(rate="RATE-LAB-01", category="labour", quantity=4, duration=80, duration_unit="hr"),
            dict(rate="RATE-EQP-01", category="equipment", quantity=2, duration=10, duration_unit="day"),
            dict(rate="RATE-EQP-02", category="equipment", quantity=3, duration=80, duration_unit="hr"),
            pct("contingency", 20)],
            dict(scope_description="Debris removal along Highway 5, km 12-18.",
                 assumptions=["Site access available from week 1"], exclusions=["Permanent bridge replacement"]),
            "First Class D estimate")
        v11 = self.estimate("T-014", "1.1", "Debris removal - Highway 5, km 12-18", [
            dict(rate="RATE-LAB-01", category="labour", quantity=4, duration=80, duration_unit="hr"),
            dict(rate="RATE-EQP-01", category="equipment", quantity=2, duration=10, duration_unit="day"),
            dict(rate="RATE-EQP-02", category="equipment", quantity=3, duration=80, duration_unit="hr"),
            dict(rate="RATE-FAC-01", category="facility_rental", quantity=1, duration=1, duration_unit="mo"),
            pct("overhead", 10), pct("escalation", 3), pct("engineering_allowance", 8),
            pct("contingency", 30, "High uncertainty - access road condition UNKNOWN")],
            dict(scope_description="Debris removal and temporary road repair along Highway 5, km 12-18.",
                 assumptions=["Site access available from week 2", "Crews work 10-hour days, 5 days a week"],
                 exclusions=["Permanent bridge replacement", "Hazardous materials disposal"]),
            "New revision after access road survey", supersedes=v10)
        self.set_status(v10, "archived", self.prep, "Replaced by v1.1")
        self.set_status(v11, "in_review", self.prep, "Submitted for review")
        self.set_status(v11, "approved", self.rev, "Approved", reviewed_by=self.rev, reviewed_at=timezone.now())

        t20 = self.estimate("T-020", "1.0", "Clear burned debris from residential lots", [
            dict(rate="RATE-SUB-01", category="subcontractors", quantity=1, duration=30, duration_unit="day"),
            dict(rate="RATE-SUB-02", category="subcontractors", quantity=1, duration=30, duration_unit="day"),
            pct("contingency", 20)],
            dict(scope_description="Removal of burned structures and debris from 42 residential lots.",
                 assumptions=["Lots cleared for asbestos testing first"], exclusions=["Rebuilding homes"]),
            "First Class D estimate")
        t22 = self.estimate("T-022", "1.0", "Temporary reception centre", [
            dict(rate="RATE-FAC-03", category="facility_rental", quantity=1, duration=60, duration_unit="day"),
            dict(rate="RATE-FAC-04", category="facility_rental", quantity=10, duration=2, duration_unit="mo"),
            pct("contingency", 25)],
            dict(scope_description="Reception centre for displaced residents for 60 days.",
                 assumptions=["Hall available rent-free after day 60"], exclusions=["Food and lodging costs"]),
            "First Class D estimate")
        self.set_status(t22, "in_review", self.prep, "Submitted for review")

        # Funding
        src = lambda code, name, st, mg, amt, status, conf, likely, tactics, docs: FundingSource.objects.create(
            event_id=EV, code=code, name=name, source_type=st, mix_group=mg, amount=amt, status=status,
            confirmed=conf, likely=likely, tactic_ids=tactics, document_ids=docs, created_by=self.prep)
        fs1 = src("FS-01", "Provincial disaster financial assistance (illustrative - confirm eligibility with program guidelines)",
                  "provincial_dfa", "government", 200000, "requested", False, True, ["T-014", "T-020"], ["DOC-0040"])
        src("FS-02", "Federal infrastructure program (illustrative)", "federal_program", "government", 75000,
            "approved", True, True, ["T-014"], ["DOC-0041"])
        src("FS-03", "Regional district reserves", "local_reserves", "local_gov", 60000, "approved", True, True, ["T-022"], [])
        src("FS-05", "Community crowdfunding", "community_fundraising", "community", 15000, "requested", False, False,
            ["T-022"], [])
        FundingMix.objects.create(event_id=EV, government_pct=70, local_gov_pct=20, community_pct=10, created_by=self.prep)
        FundingRequest.objects.create(
            event_id=EV, code="FR-01", funding_source=fs1, amount=200000, status="sent", generated_by="template",
            title="Request for disaster financial assistance - Clearwater Ridge Wildfire",
            letter_subject="Request for Disaster Financial Assistance - Clearwater Ridge Wildfire (EV-2026-014)",
            letter_body="TEMPLATE - not AI generated. Dear Program Officer, ...",
            document_id="DOC-0040", approval_id="APR-0015", sent_at=timezone.now(), created_by=self.prep)

        # Money history for T-014
        for code, stage, amount, d, ref, doc, note in [
            ("FE-0001", "commitment", 45000, date(2026, 11, 20), "PO-2026-118", "DOC-0045", "Debris removal contract signed"),
            ("FE-0002", "expenditure", 30500, date(2026, 12, 4), "INV-88231", "DOC-0052", "First invoice - 2 weeks of work"),
            ("FE-0003", "claim", 30500, date(2026, 12, 6), "CLM-2026-07", "DOC-0053", "Claim submitted to provincial program"),
            ("FE-0004", "reimbursement", 24400, date(2026, 12, 20), "EFT-55120", "DOC-0060",
             "80% of eligible claim reimbursed (illustrative)"),
        ]:
            FinancialEntry.objects.create(event_id=EV, code=code, tactic_id="T-014", stage=stage, amount=amount,
                                          entry_date=d, reference=ref, document_ids=[doc], note=note,
                                          created_by=self.prep)

        AssistanceItem.objects.create(event_id=EV, code="AS-01", assistance_type="engineers", quantity=2,
                                      description="Geotechnical engineers to assess slope stability",
                                      provider="Provincial ministry (illustrative)", status="requested",
                                      created_by=self.prep)
