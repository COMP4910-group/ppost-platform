"""
Finance tables (owner: Daniel).

  finance_rate               standard unit rates (the Rate Table)
  finance_estimate           one Class D estimate revision for one PPOST tactic
  finance_cost_line          the lines inside an estimate (unit-rate or percentage)
  finance_basis_of_estimate  scope, assumptions and exclusions for an estimate
  finance_funding_source     money sources (government, local, community, insurance ...)
  finance_funding_request    funding request letters (FR-##)
  finance_financial_entry    APPEND-ONLY money history (commitment, spending, claims ...)
  finance_assistance_item    non-financial help (equipment, engineers, volunteers ...)
  finance_funding_mix        government / local government / community split (sums to 100)
  finance_change             APPEND-ONLY audit log for every finance table

Rules kept by the database or the models:
  * money is never negative; totals are calculated on the server (see calculations.py)
  * an estimate revision is unique per event + tactic + revision
  * the reviewer can never be the person who prepared the estimate
  * an approved estimate (and its lines) can't be edited - make a new revision
  * financial entries and the change log are never edited or deleted
"""
from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models, transaction
from django.db.models import F, Q

from . import calculations

MONEY = {"max_digits": 14, "decimal_places": 2}
QTY = {"max_digits": 12, "decimal_places": 3}
USER = settings.AUTH_USER_MODEL


class Category(models.TextChoices):
    LABOUR = "labour", "Labour"
    EQUIPMENT = "equipment", "Equipment"
    MATERIALS = "materials", "Materials"
    SUBCONTRACTORS = "subcontractors", "Subcontractors"
    FACILITY_RENTAL = "facility_rental", "Facility Rental"
    OVERHEAD = "overhead", "Overhead"
    ESCALATION = "escalation", "Escalation"
    ENGINEERING_ALLOWANCE = "engineering_allowance", "Engineering Allowance"
    CONTINGENCY = "contingency", "Contingency"


class RecordStatus(models.TextChoices):
    """Shared team status words."""
    DRAFT = "draft", "Draft"
    IN_REVIEW = "in_review", "In review"
    APPROVED = "approved", "Approved"
    ARCHIVED = "archived", "Archived"


class FundingStatus(models.TextChoices):
    NEEDED = "needed", "Needed"
    REQUESTED = "requested", "Requested"
    APPROVED = "approved", "Approved"
    RECEIVED = "received", "Received"


class Tracked(models.Model):
    """Who created / last changed a row, and when (server time, UTC)."""
    created_by = models.ForeignKey(USER, null=True, blank=True, on_delete=models.SET_NULL, related_name="+")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_by = models.ForeignKey(USER, null=True, blank=True, on_delete=models.SET_NULL, related_name="+")
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        abstract = True


# ─── Rate Table ───────────────────────────────────────────────────────────────

class Rate(Tracked):
    code = models.CharField(max_length=40, unique=True)  # e.g. RATE-EQP-01
    category = models.CharField(max_length=30, choices=Category.choices)
    resource = models.CharField(max_length=200)
    unit = models.CharField(max_length=20)  # hr, day, wk, mo, m3, each, lump ...
    base_rate = models.DecimalField(**MONEY)
    regional_rate = models.DecimalField(**MONEY, null=True, blank=True)
    source = models.CharField(max_length=300, blank=True)
    effective_date = models.DateField()
    is_archived = models.BooleanField(default=False)

    class Meta:
        db_table = "finance_rate"
        ordering = ["category", "resource"]
        constraints = [
            models.CheckConstraint(condition=Q(base_rate__gte=0), name="finance_rate_base_nonneg"),
            models.CheckConstraint(condition=Q(regional_rate__isnull=True) | Q(regional_rate__gte=0),
                                   name="finance_rate_regional_nonneg"),
        ]

    @property
    def effective_rate(self):
        return self.regional_rate if self.regional_rate is not None else self.base_rate

    def __str__(self):
        return f"{self.code} {self.resource} ({self.effective_rate}/{self.unit})"


# ─── Class D estimate ─────────────────────────────────────────────────────────

class Estimate(Tracked):
    event_id = models.CharField(max_length=40, db_index=True)  # e.g. EV-2026-014
    tactic_id = models.CharField(max_length=40, db_index=True)  # PPOST tactic, e.g. T-014
    revision = models.CharField(max_length=10)  # "1.0", "1.1" ...
    title = models.CharField(max_length=300, blank=True)
    status = models.CharField(max_length=12, choices=RecordStatus.choices, default=RecordStatus.DRAFT)
    estimate_class = models.CharField(max_length=1, choices=[(c, f"Class {c}") for c in "ABCD"], default="D")
    accuracy_low_pct = models.SmallIntegerField(default=-50)
    accuracy_high_pct = models.SmallIntegerField(default=100)
    currency = models.CharField(max_length=3, default="CAD")
    supersedes = models.ForeignKey("self", null=True, blank=True, on_delete=models.SET_NULL,
                                   related_name="superseded_by")
    prepared_by = models.ForeignKey(USER, null=True, blank=True, on_delete=models.SET_NULL, related_name="+")
    prepared_date = models.DateField(null=True, blank=True)
    reviewed_by = models.ForeignKey(USER, null=True, blank=True, on_delete=models.SET_NULL, related_name="+")
    reviewed_at = models.DateTimeField(null=True, blank=True)
    approval_id = models.CharField(max_length=20, blank=True)  # APR-#### from Documents & Evidence
    document_ids = models.JSONField(default=list, blank=True)  # ["DOC-0031", ...]
    # Calculated by the server from the cost lines - never sent by the browser
    direct_total = models.DecimalField(**MONEY, default=0, editable=False)
    total = models.DecimalField(**MONEY, default=0, editable=False)
    low = models.DecimalField(**MONEY, default=0, editable=False)
    high = models.DecimalField(**MONEY, default=0, editable=False)

    class Meta:
        db_table = "finance_estimate"
        ordering = ["event_id", "tactic_id", "revision"]
        constraints = [
            models.UniqueConstraint(fields=["event_id", "tactic_id", "revision"], name="finance_estimate_unique_rev"),
            models.CheckConstraint(condition=Q(reviewed_by__isnull=True) | ~Q(reviewed_by=F("prepared_by")),
                                   name="finance_estimate_reviewer_not_preparer"),
            models.CheckConstraint(condition=~Q(status="approved") | Q(reviewed_by__isnull=False),
                                   name="finance_estimate_approved_has_reviewer"),
        ]

    @property
    def code(self):
        """Record id used in the API / JSON, e.g. 'T-014:v1.1'."""
        return f"{self.tactic_id}:v{self.revision}"

    def __str__(self):
        return f"{self.event_id} {self.code} [{self.status}] {self.total}"

    def is_locked(self):
        return self.status == RecordStatus.APPROVED

    def save(self, *args, **kwargs):
        if self.pk:
            old = Estimate.objects.filter(pk=self.pk).values("status").first()
            if old and old["status"] == RecordStatus.APPROVED and self.status != RecordStatus.ARCHIVED:
                allowed = set(kwargs.get("update_fields") or [])
                if not allowed or not allowed <= {"status", "updated_at", "updated_by"}:
                    raise ValidationError("This estimate is approved and locked. Create a new revision instead.")
        super().save(*args, **kwargs)

    @transaction.atomic
    def recalculate(self):
        """Recalculate every line and the estimate totals, and save them."""
        lines = list(self.lines.all())
        line_totals = calculations.resolve_line_costs(lines)
        changed = []
        for line, t in zip(lines, line_totals):
            if line.total_cost != t:
                line.total_cost = t
                changed.append(line)
        if changed:
            CostLine.objects.bulk_update(changed, ["total_cost"])
        t = calculations.estimate_totals(lines, line_totals, self.accuracy_low_pct, self.accuracy_high_pct)
        self.direct_total, self.total, self.low, self.high = t["direct"], t["total"], t["low"], t["high"]
        Estimate.objects.filter(pk=self.pk).update(
            direct_total=self.direct_total, total=self.total, low=self.low, high=self.high)
        return t


class CostLine(models.Model):
    class Pricing(models.TextChoices):
        UNIT = "unit", "Unit rate"
        PERCENT = "percent", "% of base"

    class DurationUnit(models.TextChoices):
        HOUR = "hr", "Hours"
        DAY = "day", "Days"
        WEEK = "wk", "Weeks"
        MONTH = "mo", "Months"

    estimate = models.ForeignKey(Estimate, on_delete=models.CASCADE, related_name="lines")
    position = models.PositiveSmallIntegerField(default=0)
    description = models.CharField(max_length=300, blank=True)
    category = models.CharField(max_length=30, choices=Category.choices)
    pricing = models.CharField(max_length=8, choices=Pricing.choices, default=Pricing.UNIT)
    quantity = models.DecimalField(**QTY, default=1)
    unit = models.CharField(max_length=20, blank=True)
    unit_rate = models.DecimalField(**MONEY, default=0)
    duration = models.DecimalField(**QTY, default=1)
    duration_unit = models.CharField(max_length=3, choices=DurationUnit.choices, default=DurationUnit.DAY)
    percent = models.DecimalField(max_digits=6, decimal_places=2, null=True, blank=True)
    rate = models.ForeignKey(Rate, null=True, blank=True, on_delete=models.SET_NULL, related_name="cost_lines")
    total_cost = models.DecimalField(**MONEY, default=0, editable=False)  # calculated by the server
    notes = models.TextField(blank=True)

    class Meta:
        db_table = "finance_cost_line"
        ordering = ["estimate", "position", "id"]
        constraints = [
            models.CheckConstraint(condition=Q(quantity__gte=0) & Q(unit_rate__gte=0) & Q(duration__gte=0),
                                   name="finance_line_nonneg"),
            models.CheckConstraint(condition=Q(percent__isnull=True) | Q(percent__gte=0), name="finance_line_pct_nonneg"),
            models.CheckConstraint(
                condition=Q(pricing="unit") | Q(category__in=calculations.PERCENT_CATEGORIES),
                name="finance_line_percent_category"),
        ]

    def _check_unlocked(self):
        if self.estimate.is_locked():
            raise ValidationError("This estimate is approved and locked. Create a new revision instead.")

    def save(self, *args, **kwargs):
        self._check_unlocked()
        super().save(*args, **kwargs)

    def delete(self, *args, **kwargs):
        self._check_unlocked()
        return super().delete(*args, **kwargs)

    def __str__(self):
        return f"{self.description or self.category} = {self.total_cost}"


class BasisOfEstimate(models.Model):
    estimate = models.OneToOneField(Estimate, on_delete=models.CASCADE, related_name="basis")
    scope_description = models.TextField(blank=True)
    assumptions = models.JSONField(default=list, blank=True)  # ["Site access from week 2", ...]
    exclusions = models.JSONField(default=list, blank=True)

    class Meta:
        db_table = "finance_basis_of_estimate"
        verbose_name_plural = "basis of estimate records"

    def save(self, *args, **kwargs):
        if self.estimate.is_locked():
            raise ValidationError("This estimate is approved and locked. Create a new revision instead.")
        super().save(*args, **kwargs)

    def __str__(self):
        return f"Basis of estimate for {self.estimate.code}"


# ─── Funding ──────────────────────────────────────────────────────────────────

class FundingSource(Tracked):
    class SourceType(models.TextChoices):
        LOCAL_RESERVES = "local_reserves", "Local government reserves"
        PROVINCIAL_DFA = "provincial_dfa", "Provincial disaster financial assistance"
        FEDERAL_PROGRAM = "federal_program", "Federal program"
        NGO_CHARITY = "ngo_charity", "NGO / charity"
        COMMUNITY = "community_fundraising", "Community fundraising / crowdfunding"
        INSURANCE = "insurance", "Insurance"
        IN_KIND = "in_kind", "In-kind"

    class MixGroup(models.TextChoices):
        GOVERNMENT = "government", "Government"
        LOCAL_GOV = "local_gov", "Local government"
        COMMUNITY = "community", "Community / online / NGO"

    event_id = models.CharField(max_length=40, db_index=True)
    code = models.CharField(max_length=20)  # FS-01
    name = models.CharField(max_length=300)
    source_type = models.CharField(max_length=30, choices=SourceType.choices)
    mix_group = models.CharField(max_length=12, choices=MixGroup.choices)
    amount = models.DecimalField(**MONEY, default=0)
    status = models.CharField(max_length=10, choices=FundingStatus.choices, default=FundingStatus.NEEDED)
    confirmed = models.BooleanField(default=False)
    likely = models.BooleanField(default=False)
    tactic_ids = models.JSONField(default=list, blank=True)
    document_ids = models.JSONField(default=list, blank=True)
    notes = models.TextField(blank=True)
    is_archived = models.BooleanField(default=False)

    class Meta:
        db_table = "finance_funding_source"
        ordering = ["event_id", "code"]
        constraints = [
            models.UniqueConstraint(fields=["event_id", "code"], name="finance_source_unique_code"),
            models.CheckConstraint(condition=Q(amount__gte=0), name="finance_source_amount_nonneg"),
        ]

    def __str__(self):
        return f"{self.event_id} {self.code} {self.name} {self.amount} [{self.status}]"


class FundingRequest(Tracked):
    class Status(models.TextChoices):
        DRAFT = "draft", "Draft"
        IN_REVIEW = "in_review", "In review"
        APPROVED = "approved", "Approved"
        SENT = "sent", "Sent"
        ARCHIVED = "archived", "Archived"

    class GeneratedBy(models.TextChoices):
        TEMPLATE = "template", "Template"
        AI = "ai", "AI draft - review before sending"
        PERSON = "person", "Written by a person"

    event_id = models.CharField(max_length=40, db_index=True)
    code = models.CharField(max_length=20)  # FR-01
    funding_source = models.ForeignKey(FundingSource, null=True, blank=True, on_delete=models.SET_NULL,
                                       related_name="requests")
    title = models.CharField(max_length=300)
    amount = models.DecimalField(**MONEY, default=0)
    status = models.CharField(max_length=12, choices=Status.choices, default=Status.DRAFT)
    letter_subject = models.CharField(max_length=300, blank=True)
    letter_body = models.TextField(blank=True)
    generated_by = models.CharField(max_length=10, choices=GeneratedBy.choices, default=GeneratedBy.TEMPLATE)
    document_id = models.CharField(max_length=20, blank=True)  # DOC-####
    approval_id = models.CharField(max_length=20, blank=True)  # APR-####
    sent_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = "finance_funding_request"
        ordering = ["event_id", "code"]
        constraints = [
            models.UniqueConstraint(fields=["event_id", "code"], name="finance_request_unique_code"),
            models.CheckConstraint(condition=Q(amount__gte=0), name="finance_request_amount_nonneg"),
        ]

    def __str__(self):
        return f"{self.event_id} {self.code} {self.title} [{self.status}]"


class FinancialEntry(models.Model):
    """One step in a tactic's money lifecycle. Append-only: to correct a mistake,
    add a new entry with a note instead of editing."""

    class Stage(models.TextChoices):
        NEED = "need", "Need"
        ESTIMATE = "estimate", "Estimate"
        FUNDING_ASK = "funding_ask", "Funding ask"
        APPROVAL = "approval", "Approval"
        COMMITMENT = "commitment", "Commitment"
        EXPENDITURE = "expenditure", "Expenditure"
        CLAIM = "claim", "Claim"
        REIMBURSEMENT = "reimbursement", "Reimbursement"
        CLOSEOUT = "closeout", "Closeout"

    event_id = models.CharField(max_length=40, db_index=True)
    code = models.CharField(max_length=20)  # FE-0001
    tactic_id = models.CharField(max_length=40, db_index=True)
    stage = models.CharField(max_length=15, choices=Stage.choices)
    amount = models.DecimalField(**MONEY)
    entry_date = models.DateField()
    reference = models.CharField(max_length=100, blank=True)  # PO / invoice / claim number
    document_ids = models.JSONField(default=list, blank=True)
    note = models.TextField(blank=True)
    created_by = models.ForeignKey(USER, null=True, blank=True, on_delete=models.SET_NULL, related_name="+")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "finance_financial_entry"
        ordering = ["event_id", "tactic_id", "created_at"]
        verbose_name_plural = "financial entries"
        constraints = [models.UniqueConstraint(fields=["event_id", "code"], name="finance_entry_unique_code")]

    def save(self, *args, **kwargs):
        if self.pk and FinancialEntry.objects.filter(pk=self.pk).exists():
            raise ValidationError("Financial entries can't be edited. Add a new entry to correct it.")
        super().save(*args, **kwargs)

    def delete(self, *args, **kwargs):
        raise ValidationError("Financial entries can't be deleted.")

    def __str__(self):
        return f"{self.event_id} {self.code} {self.tactic_id} {self.stage} {self.amount}"


class AssistanceItem(Tracked):
    class AssistanceType(models.TextChoices):
        EQUIPMENT = "equipment", "Equipment"
        ENGINEERS = "engineers", "Engineers"
        TEMPORARY_HOUSING = "temporary_housing", "Temporary housing units"
        VOLUNTEERS = "volunteers", "Volunteers"
        EXPEDITED_PERMITS = "expedited_permits", "Expedited permits"
        OTHER = "other", "Other"

    event_id = models.CharField(max_length=40, db_index=True)
    code = models.CharField(max_length=20)  # AS-01
    assistance_type = models.CharField(max_length=20, choices=AssistanceType.choices)
    description = models.CharField(max_length=300)
    quantity = models.PositiveIntegerField(default=1)
    provider = models.CharField(max_length=200, blank=True)
    status = models.CharField(max_length=10, choices=FundingStatus.choices, default=FundingStatus.NEEDED)
    is_archived = models.BooleanField(default=False)

    class Meta:
        db_table = "finance_assistance_item"
        ordering = ["event_id", "code"]
        constraints = [models.UniqueConstraint(fields=["event_id", "code"], name="finance_assistance_unique_code")]

    def __str__(self):
        return f"{self.event_id} {self.code} {self.description} [{self.status}]"


class FundingMix(Tracked):
    event_id = models.CharField(max_length=40, unique=True)
    government_pct = models.PositiveSmallIntegerField(default=100)
    local_gov_pct = models.PositiveSmallIntegerField(default=0)
    community_pct = models.PositiveSmallIntegerField(default=0)

    class Meta:
        db_table = "finance_funding_mix"
        verbose_name_plural = "funding mixes"
        constraints = [
            models.CheckConstraint(condition=Q(government_pct=100 - F("local_gov_pct") - F("community_pct")),
                                   name="finance_mix_sums_to_100"),
        ]

    def __str__(self):
        return f"{self.event_id}: {self.government_pct}/{self.local_gov_pct}/{self.community_pct}"


# ─── Audit log ────────────────────────────────────────────────────────────────

class FinanceChange(models.Model):
    """Append-only history of every finance change: who, when, what changed."""

    class Action(models.TextChoices):
        CREATE = "create", "Created"
        UPDATE = "update", "Updated"
        ARCHIVE = "archive", "Archived"
        RESTORE = "restore", "Restored"

    event_id = models.CharField(max_length=40, blank=True, db_index=True)  # blank for rates (not per event)
    table = models.CharField(max_length=40)  # rate, estimate, funding_source ...
    record_code = models.CharField(max_length=60, db_index=True)  # RATE-EQP-01, T-014:v1.1, FS-01 ...
    action = models.CharField(max_length=10, choices=Action.choices)
    changed_fields = models.JSONField(default=list)
    before = models.JSONField(null=True, blank=True)
    after = models.JSONField(null=True, blank=True)
    user = models.ForeignKey(USER, null=True, blank=True, on_delete=models.SET_NULL, related_name="+")
    username = models.CharField(max_length=150)  # kept even if the account is removed
    at = models.DateTimeField(auto_now_add=True, db_index=True)  # server time (UTC) = official time
    client_at = models.DateTimeField(null=True, blank=True)
    reason = models.CharField(max_length=300, blank=True)

    class Meta:
        db_table = "finance_change"
        ordering = ["-at", "-id"]

    def save(self, *args, **kwargs):
        if self.pk and FinanceChange.objects.filter(pk=self.pk).exists():
            raise ValidationError("The finance change log can't be edited.")
        super().save(*args, **kwargs)

    def delete(self, *args, **kwargs):
        raise ValidationError("The finance change log can't be deleted.")

    def __str__(self):
        return f"{self.at:%Y-%m-%d %H:%M} {self.username} {self.action} {self.table} {self.record_code}"
