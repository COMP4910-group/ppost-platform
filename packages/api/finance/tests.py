from datetime import date
from decimal import Decimal as D

from django.contrib.auth.models import User
from django.core.exceptions import ValidationError
from django.core.management import call_command
from django.db import IntegrityError, transaction
from django.test import TestCase

from . import calculations
from .audit import record_change, snapshot
from .models import (BasisOfEstimate, CostLine, Estimate, FinanceChange, FinancialEntry, FundingMix,
                     FundingSource, Rate)

EV = "EV-2026-014"


def build_example(estimate):
    """The worked example from the JSON draft: $78,000 direct -> $124,077.10 total."""
    rows = [
        dict(category="labour", quantity=4, unit_rate=55, duration=80),
        dict(category="equipment", quantity=2, unit_rate=1400, duration=10),
        dict(category="equipment", quantity=3, unit_rate=130, duration=80),
        dict(category="facility_rental", quantity=1, unit_rate=1200, duration=1),
        dict(category="overhead", pricing="percent", percent=10),
        dict(category="escalation", pricing="percent", percent=3),
        dict(category="engineering_allowance", pricing="percent", percent=8),
        dict(category="contingency", pricing="percent", percent=30),
    ]
    for i, r in enumerate(rows):
        CostLine.objects.create(estimate=estimate, position=i, **r)
    return estimate.recalculate()


class CalculationTests(TestCase):
    def setUp(self):
        self.daniel = User.objects.create_user("daniel", password="pw")
        self.earl = User.objects.create_user("earl", password="pw")
        self.est = Estimate.objects.create(event_id=EV, tactic_id="T-014", revision="1.1", prepared_by=self.daniel)

    def test_worked_example_matches_frontend(self):
        t = build_example(self.est)
        self.assertEqual(t["direct"], D("78000.00"))
        self.assertEqual(t["by_category"]["overhead"], D("7800.00"))
        self.assertEqual(t["by_category"]["escalation"], D("2574.00"))
        self.assertEqual(t["by_category"]["engineering_allowance"], D("7069.92"))
        self.assertEqual(t["by_category"]["contingency"], D("28633.18"))
        self.est.refresh_from_db()
        self.assertEqual((self.est.total, self.est.low, self.est.high),
                         (D("124077.10"), D("62038.55"), D("248154.20")))
        self.assertEqual(self.est.lines.get(category="contingency").total_cost, D("28633.18"))

    def test_percent_on_direct_category_is_blocked(self):
        with self.assertRaises(IntegrityError), transaction.atomic():
            CostLine.objects.create(estimate=self.est, category="labour", pricing="percent", percent=50)

    def test_negative_values_are_blocked(self):
        with self.assertRaises(IntegrityError), transaction.atomic():
            CostLine.objects.create(estimate=self.est, category="labour", quantity=-1, unit_rate=10)

    def test_helper_ignores_bad_inputs(self):
        self.assertEqual(calculations.unit_cost(None, 10, 2), D("0.00"))
        self.assertEqual(calculations.unit_cost(-3, 10, 2), D("0.00"))


class EstimateRuleTests(TestCase):
    def setUp(self):
        self.daniel = User.objects.create_user("daniel", password="pw")
        self.earl = User.objects.create_user("earl", password="pw")
        self.est = Estimate.objects.create(event_id=EV, tactic_id="T-014", revision="1.0", prepared_by=self.daniel)
        BasisOfEstimate.objects.create(estimate=self.est, scope_description="Debris removal",
                                       assumptions=["Access from week 2"], exclusions=["Bridge"])

    def test_revision_is_unique_per_tactic(self):
        with self.assertRaises(IntegrityError), transaction.atomic():
            Estimate.objects.create(event_id=EV, tactic_id="T-014", revision="1.0")
        Estimate.objects.create(event_id=EV, tactic_id="T-014", revision="1.1")  # new revision is fine

    def test_reviewer_cannot_be_preparer(self):
        self.est.reviewed_by = self.daniel
        with self.assertRaises(IntegrityError), transaction.atomic():
            self.est.save()

    def test_approved_needs_a_reviewer(self):
        self.est.status = "approved"
        with self.assertRaises(IntegrityError), transaction.atomic():
            self.est.save()

    def test_approved_estimate_is_locked(self):
        line = CostLine.objects.create(estimate=self.est, category="labour", quantity=1, unit_rate=50, duration=8)
        self.est.status, self.est.reviewed_by = "approved", self.earl
        self.est.save()
        self.est.title = "Changed after approval"
        with self.assertRaises(ValidationError):
            self.est.save()
        line.refresh_from_db()
        line.unit_rate = 999
        with self.assertRaises(ValidationError):
            line.save()
        with self.assertRaises(ValidationError):
            CostLine.objects.create(estimate=self.est, category="labour")
        basis = self.est.basis
        basis.scope_description = "New scope"
        with self.assertRaises(ValidationError):
            basis.save()

    def test_approved_estimate_can_be_archived(self):
        self.est.status, self.est.reviewed_by = "approved", self.earl
        self.est.save()
        self.est.status = "archived"
        self.est.save(update_fields=["status", "updated_at"])
        self.est.refresh_from_db()
        self.assertEqual(self.est.status, "archived")


class FundingTests(TestCase):
    def test_mix_must_sum_to_100(self):
        FundingMix.objects.create(event_id=EV, government_pct=70, local_gov_pct=20, community_pct=10)
        with self.assertRaises(IntegrityError), transaction.atomic():
            FundingMix.objects.create(event_id="EV-OTHER", government_pct=70, local_gov_pct=20, community_pct=20)

    def test_source_code_unique_per_event_and_amount_nonneg(self):
        kw = dict(name="Province", source_type="provincial_dfa", mix_group="government", amount=1000)
        FundingSource.objects.create(event_id=EV, code="FS-01", **kw)
        FundingSource.objects.create(event_id="EV-OTHER", code="FS-01", **kw)  # other event is fine
        with self.assertRaises(IntegrityError), transaction.atomic():
            FundingSource.objects.create(event_id=EV, code="FS-01", **kw)
        with self.assertRaises(IntegrityError), transaction.atomic():
            FundingSource.objects.create(event_id=EV, code="FS-02", **{**kw, "amount": -5})

    def test_financial_entries_are_append_only(self):
        e = FinancialEntry.objects.create(event_id=EV, code="FE-0001", tactic_id="T-014", stage="commitment",
                                          amount=45000, entry_date=date(2026, 11, 20), reference="PO-2026-118")
        e.amount = 1
        with self.assertRaises(ValidationError):
            e.save()
        with self.assertRaises(ValidationError):
            e.delete()


class AuditTests(TestCase):
    def test_change_log_records_who_and_what(self):
        daniel = User.objects.create_user("daniel", password="pw")
        rate = Rate.objects.create(code="RATE-LAB-01", category="labour", resource="General Labourer", unit="hr",
                                   base_rate=55, effective_date=date(2026, 1, 1))
        record_change(rate, "create", daniel)
        before = snapshot(rate)
        rate.regional_rate = 60
        rate.save()
        log = record_change(rate, "update", daniel, before=before, reason="Interior BC rate")
        self.assertEqual(log.changed_fields, ["regional_rate"])
        self.assertEqual(log.username, "daniel")
        self.assertEqual(log.table, "rate")
        self.assertEqual(log.record_code, "RATE-LAB-01")
        self.assertIsNone(record_change(rate, "update", daniel, before=snapshot(rate)))  # nothing changed
        with self.assertRaises(ValidationError):
            log.reason = "edited"
            log.save()
        with self.assertRaises(ValidationError):
            log.delete()
        self.assertEqual(FinanceChange.objects.count(), 2)

    def test_estimate_snapshot_includes_lines_and_basis(self):
        est = Estimate.objects.create(event_id=EV, tactic_id="T-020", revision="1.0")
        build_example(est)
        BasisOfEstimate.objects.create(estimate=est, scope_description="Road repair")
        est.refresh_from_db()
        snap = snapshot(est)
        self.assertEqual(len(snap["lines"]), 8)
        self.assertEqual(snap["total"], "124077.10")
        self.assertEqual(snap["basis"]["scope_description"], "Road repair")


class SeedCommandTests(TestCase):
    def test_seed_is_safe_to_run_twice(self):
        call_command("seed_finance_rates", verbosity=0)
        call_command("seed_finance_rates", verbosity=0)
        self.assertEqual(Rate.objects.count(), 22)
        self.assertEqual(Rate.objects.get(code="RATE-FAC-01").resource, "Site Office Trailer")


# ─── Finance report (JSON for Johnny's reports) ──────────────────────────────
import json
import tempfile
from pathlib import Path

from rest_framework.test import APIClient

from .report import build_report

try:
    import jsonschema
except ImportError:  # optional: only used to check the report against report_schema.json
    jsonschema = None

SCHEMA = json.loads((Path(__file__).parent / "report_schema.json").read_text(encoding="utf-8"))


class ReportTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        call_command("seed_finance_demo", verbosity=0)

    def test_totals_add_up(self):
        r = build_report(EV)
        s = r["summary"]
        self.assertEqual(s["finalized"], 124077.10)  # T-014 v1.1 approved
        self.assertEqual(s["draft"], 278050.00)  # T-020 226,800 + T-022 51,250
        self.assertEqual(s["requirement"], 402127.10)
        self.assertEqual((s["approved_funding"], s["likely_funding"]), (135000.00, 200000.00))
        self.assertEqual(s["gap"], 67127.10)
        self.assertEqual((s["committed"], s["spent"], s["claimed"], s["reimbursed"]), (45000.0, 30500.0, 30500.0, 24400.0))
        self.assertAlmostEqual(sum(r["funding"]["mix_amounts"].values()), 402127.10, places=2)
        for e in r["estimates"]:
            self.assertAlmostEqual(sum(l["total_cost"] for l in e["lines"]), e["total"], places=2)
        self.assertTrue(r["synthetic"])
        self.assertIn("SYNTHETIC", r["disclaimer"])

    def test_only_current_revision_and_history(self):
        r = build_report(EV)
        t14 = [e for e in r["estimates"] if e["tactic_id"] == "T-014"]
        self.assertEqual([e["revision"] for e in t14], ["1.1"])
        self.assertEqual(t14[0]["reviewed_by"], "demo_reviewer")
        self.assertEqual(t14[0]["supersedes"], "T-014:v1.0")
        hist = [h for h in r["cost_history"] if h["tactic_id"] == "T-014"]
        self.assertEqual(hist[0]["change_from_previous"], None)
        self.assertEqual(hist[-1]["status"], "approved")
        new = next(h for h in hist if h["revision"] == "1.1")
        self.assertEqual(new["change_from_previous"], round(124077.10 - 92160.00, 2))

    def test_lifecycle(self):
        life = {x["tactic_id"]: x for x in build_report(EV)["lifecycle_by_tactic"]}
        self.assertEqual(life["T-014"]["current_stage"], "reimbursement")
        self.assertEqual(life["T-014"]["remaining_budget"], round(124077.10 - 30500, 2))
        self.assertEqual(life["T-014"]["variance_status"], "within_budget")
        self.assertEqual(life["T-020"]["variance_status"], "no_budget")

    def test_matches_schema(self):
        if jsonschema is None:
            self.skipTest("pip install jsonschema to run the schema check")
        jsonschema.validate(build_report(EV), SCHEMA)
        jsonschema.validate(build_report("EV-EMPTY"), SCHEMA)  # an event with no data is still valid

    def test_api_needs_login_and_returns_json(self):
        client = APIClient()
        self.assertEqual(client.get(f"/api/finance/events/{EV}/report/").status_code, 401)
        client.force_authenticate(User.objects.get(username="demo_preparer"))
        res = client.get(f"/api/finance/events/{EV}/report/?download=1")
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.json()["summary"]["requirement"], 402127.10)
        self.assertIn("attachment", res["Content-Disposition"])
        self.assertEqual(client.get("/api/finance/events/bad id!/report/").status_code, 400)

    def test_export_command_writes_file(self):
        with tempfile.TemporaryDirectory() as d:
            out = Path(d) / "report.json"
            call_command("export_finance_report", EV, output=str(out), verbosity=0)
            self.assertEqual(json.loads(out.read_text(encoding="utf-8"))["event"]["name"], "Clearwater Ridge Wildfire")

    def test_seed_demo_runs_once(self):
        call_command("seed_finance_demo", verbosity=0)  # second run adds nothing
        self.assertEqual(Estimate.objects.filter(event_id=EV).count(), 4)
