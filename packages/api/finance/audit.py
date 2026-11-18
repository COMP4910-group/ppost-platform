"""Write finance changes to the append-only finance_change table."""
import json

from django.core.serializers.json import DjangoJSONEncoder
from django.forms.models import model_to_dict

from .models import Estimate, FinanceChange

IGNORED = {"created_at", "updated_at", "created_by", "updated_by"}


def snapshot(obj) -> dict:
    """A JSON-safe copy of a row. Estimates include their lines and basis of estimate."""
    data = {k: v for k, v in model_to_dict(obj).items() if k not in IGNORED}
    if isinstance(obj, Estimate):
        data.update(direct_total=obj.direct_total, total=obj.total, low=obj.low, high=obj.high)
        data["lines"] = [{k: v for k, v in model_to_dict(l).items() if k != "estimate"} | {"total_cost": l.total_cost}
                         for l in obj.lines.all()]
        basis = getattr(obj, "basis", None)
        data["basis"] = ({k: v for k, v in model_to_dict(basis).items() if k not in ("id", "estimate")}
                         if basis else None)
    return json.loads(json.dumps(data, cls=DjangoJSONEncoder))


def changed_fields(before, after) -> list:
    before, after = before or {}, after or {}
    return sorted(k for k in set(before) | set(after) if before.get(k) != after.get(k))


def record_change(obj, action, user, before=None, reason="", client_at=None, table=None):
    """Log one change. Pass `before=snapshot(obj)` taken BEFORE editing.
    Returns None (and logs nothing) when an update changed nothing."""
    after = snapshot(obj)
    fields = changed_fields(before, after)
    if action == FinanceChange.Action.UPDATE and not fields:
        return None
    code = getattr(obj, "code", None) or str(obj.pk)
    return FinanceChange.objects.create(
        event_id=getattr(obj, "event_id", "") or "",
        table=table or obj._meta.db_table.removeprefix("finance_"),
        record_code=code,
        action=action,
        changed_fields=fields,
        before=before,
        after=after,
        user=user if getattr(user, "is_authenticated", False) else None,
        username=user.get_username() if getattr(user, "is_authenticated", False) else "system",
        client_at=client_at,
        reason=(reason or "")[:300],
    )
