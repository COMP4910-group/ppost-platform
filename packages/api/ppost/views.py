"""
PPOST API (all endpoints require the JWT login from /api/auth/login/).

GET  /api/ppost/events/<event_id>/state/                 current records for the event
POST /api/ppost/events/<event_id>/changes/               save a batch of changes
     body: {"changes": [{"kind": "tactic", "record_id": "T-014", "action": "upsert"|"delete",
                         "data": {...}, "client_at": "2026-11-14T18:02:00Z", "reason": "..."}]}
GET  /api/ppost/events/<event_id>/history/?kind=tactic&record_id=T-014&limit=100
     change log, newest first: who, when, action, changed fields, before/after
"""
import json
import re

from django.db import transaction
from django.utils import timezone
from django.utils.dateparse import parse_datetime
from rest_framework import status
from rest_framework.decorators import api_view
from rest_framework.response import Response

from .models import KIND_VALUES, PpostChange, PpostRecord

EVENT_RE = re.compile(r"^[A-Za-z0-9_-]{1,40}$")
RECORD_RE = re.compile(r"^[A-Za-z0-9_.:-]{1,80}$")
MAX_CHANGES = 500
MAX_DATA_BYTES = 100_000


def changed_paths(before, after, prefix="", depth=0):
    """Field paths that differ, e.g. ["status", "fiveW1H.when.start"] (3 levels deep)."""
    if isinstance(before, dict) and isinstance(after, dict) and depth < 3:
        paths = []
        for key in sorted(set(before) | set(after)):
            p = f"{prefix}.{key}" if prefix else key
            paths += changed_paths(before.get(key), after.get(key), p, depth + 1)
        return paths
    return [] if before == after else [prefix or "(value)"]


def record_json(r):
    return {
        "kind": r.kind, "record_id": r.record_id, "data": r.data, "version": r.version,
        "updated_at": r.updated_at.isoformat(),
        "updated_by": r.updated_by.username if r.updated_by else None,
    }


def change_json(c):
    return {
        "id": c.id, "kind": c.kind, "record_id": c.record_id, "action": c.action, "version": c.version,
        "changed_fields": c.changed_fields, "before": c.before, "after": c.after,
        "user": c.username, "at": c.at.isoformat(),
        "client_at": c.client_at.isoformat() if c.client_at else None, "reason": c.reason,
    }


def _bad(msg, code=status.HTTP_400_BAD_REQUEST):
    return Response({"error": msg}, status=code)


@api_view(["GET"])
def state_view(request, event_id):
    if not EVENT_RE.match(event_id):
        return _bad("Invalid event id.")
    records = PpostRecord.objects.filter(event_id=event_id, is_deleted=False).select_related("updated_by")
    return Response({"event_id": event_id, "server_time": timezone.now().isoformat(),
                     "records": [record_json(r) for r in records]})


def _validate(op, i):
    if not isinstance(op, dict):
        return f"change {i}: must be an object"
    if op.get("kind") not in KIND_VALUES:
        return f"change {i}: unknown kind {op.get('kind')!r}"
    if not isinstance(op.get("record_id"), str) or not RECORD_RE.match(op["record_id"]):
        return f"change {i}: invalid record_id"
    if op.get("action") not in ("upsert", "delete"):
        return f"change {i}: action must be 'upsert' or 'delete'"
    if op["action"] == "upsert":
        if not isinstance(op.get("data"), dict):
            return f"change {i}: data must be an object"
        if len(json.dumps(op["data"])) > MAX_DATA_BYTES:
            return f"change {i}: data too large"
    return None


@api_view(["POST"])
def changes_view(request, event_id):
    if not EVENT_RE.match(event_id):
        return _bad("Invalid event id.")
    ops = request.data.get("changes") if isinstance(request.data, dict) else None
    if not isinstance(ops, list) or not ops:
        return _bad("Send {\"changes\": [...]} with at least one change.")
    if len(ops) > MAX_CHANGES:
        return _bad(f"At most {MAX_CHANGES} changes per request.")
    for i, op in enumerate(ops):
        err = _validate(op, i)
        if err:
            return _bad(err)

    user = request.user
    applied = []
    with transaction.atomic():
        for op in ops:
            kind, rid, action = op["kind"], op["record_id"], op["action"]
            client_at = parse_datetime(op["client_at"]) if isinstance(op.get("client_at"), str) else None
            reason = str(op.get("reason") or "")[:300]
            rec = (PpostRecord.objects.select_for_update()
                   .filter(event_id=event_id, kind=kind, record_id=rid).first())

            if action == "delete":
                if rec is None or rec.is_deleted:
                    applied.append({"kind": kind, "record_id": rid, "result": "unchanged"})
                    continue
                before = rec.data
                rec.is_deleted, rec.version, rec.updated_by = True, rec.version + 1, user
                rec.save()
                ch = PpostChange.objects.create(
                    event_id=event_id, kind=kind, record_id=rid, action="delete", version=rec.version,
                    changed_fields=["(deleted)"], before=before, after=None,
                    user=user, username=user.get_username(), client_at=client_at, reason=reason)
                applied.append({"kind": kind, "record_id": rid, "result": "deleted", "version": rec.version, "change_id": ch.id})
                continue

            data = op["data"]
            if rec is None:
                rec = PpostRecord.objects.create(event_id=event_id, kind=kind, record_id=rid, data=data,
                                                 created_by=user, updated_by=user)
                act, before, fields = "create", None, sorted(data.keys())
            elif rec.is_deleted:
                before = rec.data
                rec.data, rec.is_deleted, rec.version, rec.updated_by = data, False, rec.version + 1, user
                rec.save()
                act, fields = "restore", changed_paths(before, data) or ["(restored)"]
            else:
                fields = changed_paths(rec.data, data)
                if not fields:
                    applied.append({"kind": kind, "record_id": rid, "result": "unchanged", "version": rec.version})
                    continue
                before = rec.data
                rec.data, rec.version, rec.updated_by = data, rec.version + 1, user
                rec.save()
                act = "update"
            ch = PpostChange.objects.create(
                event_id=event_id, kind=kind, record_id=rid, action=act, version=rec.version,
                changed_fields=fields, before=before, after=data,
                user=user, username=user.get_username(), client_at=client_at, reason=reason)
            applied.append({"kind": kind, "record_id": rid, "result": act, "version": rec.version, "change_id": ch.id})

    return Response({"applied": applied, "server_time": timezone.now().isoformat()})


@api_view(["GET"])
def history_view(request, event_id):
    if not EVENT_RE.match(event_id):
        return _bad("Invalid event id.")
    qs = PpostChange.objects.filter(event_id=event_id)
    kind, rid = request.query_params.get("kind"), request.query_params.get("record_id")
    if kind:
        qs = qs.filter(kind=kind)
    if rid:
        qs = qs.filter(record_id=rid)
    try:
        limit = max(1, min(int(request.query_params.get("limit", 100)), 500))
    except ValueError:
        limit = 100
    return Response({"changes": [change_json(c) for c in qs[:limit]]})
