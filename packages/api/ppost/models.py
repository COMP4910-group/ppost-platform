"""
PPOST data (owner: Divyansh).

PpostRecord  = the CURRENT value of every PPOST item for an event
               (problem, objective, strategy, tactic, assessment answer, cost entry, task, AI insight ...).
PpostChange  = APPEND-ONLY audit log. One row per create / update / delete with who, when,
               which fields changed, and the full before/after values. Rows are never edited or deleted.
"""
from django.conf import settings
from django.db import models

KINDS = [
    ("priority", "Priority"),
    ("problem", "Problem"),
    ("objective", "Objective"),
    ("strategy", "Strategy"),
    ("tactic", "Tactic"),
    ("task", "Verification task"),
    ("cost", "Cost entry"),
    ("answer", "Assessment answer"),
    ("link", "Question to problem link"),
    ("ai_question", "AI question"),
    ("insight", "AI insight"),
    ("meta", "Metadata"),
]
KIND_VALUES = {k for k, _ in KINDS}


class PpostRecord(models.Model):
    event_id = models.CharField(max_length=40, db_index=True)
    kind = models.CharField(max_length=20, choices=KINDS)
    record_id = models.CharField(max_length=80)
    data = models.JSONField(default=dict)
    version = models.PositiveIntegerField(default=1)
    is_deleted = models.BooleanField(default=False)
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, on_delete=models.SET_NULL, related_name="+")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_by = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, on_delete=models.SET_NULL, related_name="+")
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        constraints = [models.UniqueConstraint(fields=["event_id", "kind", "record_id"], name="ppost_unique_record")]
        ordering = ["created_at", "id"]

    def __str__(self):
        return f"{self.event_id} {self.kind} {self.record_id} v{self.version}"


class PpostChange(models.Model):
    ACTIONS = [("create", "Created"), ("update", "Updated"), ("delete", "Deleted"), ("restore", "Restored")]

    event_id = models.CharField(max_length=40, db_index=True)
    kind = models.CharField(max_length=20, choices=KINDS)
    record_id = models.CharField(max_length=80, db_index=True)
    action = models.CharField(max_length=10, choices=ACTIONS)
    version = models.PositiveIntegerField()
    changed_fields = models.JSONField(default=list)  # e.g. ["status", "fiveW1H.when.start"]
    before = models.JSONField(null=True, blank=True)
    after = models.JSONField(null=True, blank=True)
    user = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, on_delete=models.SET_NULL, related_name="+")
    username = models.CharField(max_length=150)  # kept even if the account is removed later
    at = models.DateTimeField(auto_now_add=True, db_index=True)  # server time (UTC) = the official time
    client_at = models.DateTimeField(null=True, blank=True)  # time on the user's browser
    reason = models.CharField(max_length=300, blank=True)

    class Meta:
        ordering = ["-at", "-id"]

    def __str__(self):
        return f"{self.at:%Y-%m-%d %H:%M} {self.username} {self.action} {self.kind} {self.record_id}"
