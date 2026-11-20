"""
Build the finance report JSON for one disaster event (used by Johnny's reports).

The output follows finance/report_schema.json (schema_version 1.0). Field names
match the finance_* tables. Money is CAD as numbers with 2 decimals.
"""
from decimal import Decimal

from django.utils import timezone

from .calculations import ZERO, money
from .models import (AssistanceItem, Estimate, FinanceChange, FinancialEntry, FundingMix, FundingRequest,
                     FundingSource)

SCHEMA_VERSION = "1.0"
DISCLAIMER = "Planning and tracking only - not a payment or accounting system."
STAGES = [c for c, _ in FinancialEntry.Stage.choices]

# TODO(Earl): replace with useCurrentEvent / the events table once it exists.
KNOWN_EVENTS = {
    "EV-2026-014": {"name": "Clearwater Ridge Wildfire", "hazard": "wildfire",
                    "location": "Interior British Columbia, Canada", "declared_at": "2026-08-14", "synthetic": True},
}


def _m(value) -> float:
    return float(money(value or 0))


def _user(u):
    return u.get_username() if u else None


def _iso(dt):
    return dt.isoformat().replace("+00:00", "Z") if dt else None


def _rev_key(revision: str):
    try:
        return tuple(int(p) for p in revision.split("."))
    except ValueError:
        return (0,)


def current_estimates(event_id):
    """The newest non-archived revision of each tactic's estimate."""
    latest = {}
    qs = (Estimate.objects.filter(event_id=event_id).exclude(status="archived")
          .select_related("prepared_by", "reviewed_by", "supersedes", "basis")
          .prefetch_related("lines__rate"))
    for est in qs:
        cur = latest.get(est.tactic_id)
        if cur is None or _rev_key(est.revision) > _rev_key(cur.revision):
            latest[est.tactic_id] = est
    return [latest[k] for k in sorted(latest)]


def _estimate_json(est):
    lines = list(est.lines.all())
    by_category = {}
    for l in lines:
        by_category[l.category] = by_category.get(l.category, ZERO) + l.total_cost
    basis = getattr(est, "basis", None)
    return {
        "tactic_id": est.tactic_id,
        "title": est.title,
        "revision": est.revision,
        "code": est.code,
        "status": est.status,
        "estimate_class": est.estimate_class,
        "accuracy_low_pct": est.accuracy_low_pct,
        "accuracy_high_pct": est.accuracy_high_pct,
        "direct_total": _m(est.direct_total),
        "total": _m(est.total),
        "low": _m(est.low),
        "high": _m(est.high),
        "by_category": {k: _m(v) for k, v in by_category.items()},
        "prepared_by": _user(est.prepared_by),
        "prepared_date": est.prepared_date.isoformat() if est.prepared_date else None,
        "reviewed_by": _user(est.reviewed_by),
        "reviewed_at": _iso(est.reviewed_at),
        "supersedes": est.supersedes.code if est.supersedes else None,
        "lines": [{
            "position": l.position,
            "description": l.description,
            "category": l.category,
            "pricing": l.pricing,
            "quantity": None if l.pricing == "percent" else float(l.quantity),
            "unit": None if l.pricing == "percent" else l.unit,
            "unit_rate": None if l.pricing == "percent" else _m(l.unit_rate),
            "duration": None if l.pricing == "percent" else float(l.duration),
            "duration_unit": None if l.pricing == "percent" else l.duration_unit,
            "percent": float(l.percent) if l.pricing == "percent" and l.percent is not None else None,
            "rate_code": l.rate.code if l.rate else None,
            "total_cost": _m(l.total_cost),
            "notes": l.notes,
        } for l in lines],
        "basis": ({"scope_description": basis.scope_description, "assumptions": list(basis.assumptions),
                   "exclusions": list(basis.exclusions)} if basis else None),
    }


def cost_history(event_id):
    """Every saved estimate state from the change log, oldest first, with the change vs the previous one."""
    rows, previous = [], {}
    # Archiving an old revision is a status change, not a cost change, so it is left out.
    changes = (FinanceChange.objects.filter(event_id=event_id, table="estimate")
               .exclude(action=FinanceChange.Action.ARCHIVE).order_by("at", "id"))
    for ch in changes:
        after = ch.after or {}
        tactic_id, revision = after.get("tactic_id"), after.get("revision")
        if not tactic_id or after.get("total") is None:
            continue
        total = Decimal(str(after["total"]))
        prev = previous.get(tactic_id)
        rows.append({
            "tactic_id": tactic_id,
            "revision": revision,
            "status": after.get("status", "draft"),
            "total": _m(total),
            "change_from_previous": None if prev is None else _m_signed(total - prev),
            "change_pct": None if not prev else round(float((total - prev) / prev * 100), 2),
            "at": _iso(ch.at),
            "by": ch.username,
            "reason": ch.reason,
        })
        previous[tactic_id] = total
    return rows


def _m_signed(value) -> float:
    return float(money(value))


def tactics_needing_estimate(event_id, estimated_ids):
    """PPOST tactics with no finance estimate (read-only look at Divyansh's tables)."""
    try:
        from ppost.models import PpostRecord
    except ImportError:  # PPOST app not installed
        return []
    ids = (PpostRecord.objects.filter(event_id=event_id, kind="tactic", is_deleted=False)
           .exclude(data__status="ARCHIVED").values_list("record_id", flat=True))
    return sorted(i for i in ids if i not in estimated_ids)


def build_report(event_id, generated_by=None):
    estimates = current_estimates(event_id)
    est_json = [_estimate_json(e) for e in estimates]
    finalized = sum((e.total for e in estimates if e.status == "approved"), ZERO)
    draft = sum((e.total for e in estimates if e.status != "approved"), ZERO)
    requirement = finalized + draft

    sources = list(FundingSource.objects.filter(event_id=event_id, is_archived=False))
    approved = sum((s.amount for s in sources if s.status in ("approved", "received")), ZERO)
    requested = sum((s.amount for s in sources if s.status == "requested"), ZERO)
    likely = sum((s.amount for s in sources if s.status == "requested" and s.likely), ZERO)
    realistic = approved + likely

    mix = FundingMix.objects.filter(event_id=event_id).first()
    pct = (mix.government_pct, mix.local_gov_pct, mix.community_pct) if mix else (100, 0, 0)
    gov, loc = money(requirement * pct[0] / 100), money(requirement * pct[1] / 100)

    entries = list(FinancialEntry.objects.filter(event_id=event_id).select_related("created_by")
                   .order_by("entry_date", "created_at", "id"))

    def stage_sum(stage, tactic=None):
        return sum((e.amount for e in entries if e.stage == stage and (tactic is None or e.tactic_id == tactic)), ZERO)

    lifecycle = []
    for e in estimates:
        budget = e.total if e.status == "approved" else None
        spent = stage_sum("expenditure", e.tactic_id)
        stages = [x.stage for x in entries if x.tactic_id == e.tactic_id]
        lifecycle.append({
            "tactic_id": e.tactic_id,
            "title": e.title,
            "current_stage": max(stages, key=STAGES.index) if stages else "estimate",
            "estimate_total": _m(e.total),
            "estimate_status": e.status,
            "approved_budget": _m(budget) if budget is not None else None,
            "committed": _m(stage_sum("commitment", e.tactic_id)),
            "spent": _m(spent),
            "claimed": _m(stage_sum("claim", e.tactic_id)),
            "reimbursed": _m(stage_sum("reimbursement", e.tactic_id)),
            "remaining_budget": _m_signed(budget - spent) if budget is not None else None,
            "variance_status": "no_budget" if budget is None else ("over_budget" if spent > budget else "within_budget"),
        })

    event = KNOWN_EVENTS.get(event_id, {})
    estimated_ids = {e.tactic_id for e in estimates}
    return {
        "report_type": "finance_report",
        "schema_version": SCHEMA_VERSION,
        "generated_at": _iso(timezone.now()),
        "generated_by": generated_by or "system",
        "synthetic": bool(event.get("synthetic", False)),
        "disclaimer": DISCLAIMER + (" SYNTHETIC DEMO DATA." if event.get("synthetic") else ""),
        "currency": "CAD",
        "event": {"id": event_id, "name": event.get("name", event_id),
                  **{k: event[k] for k in ("hazard", "location", "declared_at") if k in event}},
        "summary": {
            "requirement": _m(requirement),
            "finalized": _m(finalized),
            "draft": _m(draft),
            "approved_funding": _m(approved),
            "requested_funding": _m(requested),
            "likely_funding": _m(likely),
            "realistic_funding": _m(realistic),
            "gap": _m(max(ZERO, requirement - realistic)),
            "coverage_pct": round(float(realistic / requirement * 100), 1) if requirement else 0.0,
            "committed": _m(stage_sum("commitment")),
            "spent": _m(stage_sum("expenditure")),
            "claimed": _m(stage_sum("claim")),
            "reimbursed": _m(stage_sum("reimbursement")),
            "tactics_estimated": len(estimates),
            "tactics_needing_estimate": tactics_needing_estimate(event_id, estimated_ids),
        },
        "estimates": est_json,
        "cost_history": cost_history(event_id),
        "funding": {
            "mix": {"government_pct": pct[0], "local_gov_pct": pct[1], "community_pct": pct[2]},
            "mix_amounts": {"government": _m(gov), "local_gov": _m(loc), "community": _m(requirement - gov - loc)},
            "sources": [{
                "code": s.code, "name": s.name, "source_type": s.source_type, "mix_group": s.mix_group,
                "amount": _m(s.amount), "status": s.status, "confirmed": s.confirmed, "likely": s.likely,
                "tactic_ids": list(s.tactic_ids), "document_ids": list(s.document_ids),
            } for s in sources],
            "requests": [{
                "code": r.code, "title": r.title,
                "funding_source_code": r.funding_source.code if r.funding_source else None,
                "amount": _m(r.amount), "status": r.status, "generated_by": r.generated_by,
                "document_id": r.document_id or None, "approval_id": r.approval_id or None,
                "sent_at": _iso(r.sent_at),
            } for r in FundingRequest.objects.filter(event_id=event_id).select_related("funding_source")],
        },
        "financial_entries": [{
            "code": e.code, "tactic_id": e.tactic_id, "stage": e.stage, "amount": _m_signed(e.amount),
            "entry_date": e.entry_date.isoformat(), "reference": e.reference, "document_ids": list(e.document_ids),
            "note": e.note, "created_by": _user(e.created_by) or "system", "created_at": _iso(e.created_at),
        } for e in entries],
        "lifecycle_by_tactic": lifecycle,
        "assistance": [{
            "code": a.code, "assistance_type": a.assistance_type, "description": a.description,
            "quantity": a.quantity, "provider": a.provider, "status": a.status,
        } for a in AssistanceItem.objects.filter(event_id=event_id, is_archived=False)],
    }
