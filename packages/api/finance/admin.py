"""Django admin for the finance tables (http://localhost:8000/admin/)."""
from django.contrib import admin

from .models import (AssistanceItem, BasisOfEstimate, CostLine, Estimate, FinanceChange, FinancialEntry,
                     FundingMix, FundingRequest, FundingSource, Rate)


@admin.register(Rate)
class RateAdmin(admin.ModelAdmin):
    list_display = ("code", "category", "resource", "unit", "base_rate", "regional_rate", "effective_date", "is_archived")
    list_filter = ("category", "is_archived")
    search_fields = ("code", "resource", "source")


class CostLineInline(admin.TabularInline):
    model = CostLine
    extra = 0
    fields = ("position", "description", "category", "pricing", "quantity", "unit", "unit_rate",
              "duration", "duration_unit", "percent", "rate", "total_cost")
    readonly_fields = ("total_cost",)


class BasisInline(admin.StackedInline):
    model = BasisOfEstimate
    extra = 0


@admin.register(Estimate)
class EstimateAdmin(admin.ModelAdmin):
    list_display = ("event_id", "tactic_id", "revision", "status", "total", "prepared_by", "reviewed_by", "updated_at")
    list_filter = ("event_id", "status")
    search_fields = ("tactic_id", "title")
    readonly_fields = ("direct_total", "total", "low", "high")
    inlines = [CostLineInline, BasisInline]

    def save_related(self, request, form, formsets, change):
        super().save_related(request, form, formsets, change)
        form.instance.recalculate()  # totals are always calculated by the server


@admin.register(FundingSource)
class FundingSourceAdmin(admin.ModelAdmin):
    list_display = ("event_id", "code", "name", "mix_group", "amount", "status", "confirmed", "likely")
    list_filter = ("event_id", "mix_group", "status", "is_archived")


@admin.register(FundingRequest)
class FundingRequestAdmin(admin.ModelAdmin):
    list_display = ("event_id", "code", "title", "amount", "status", "generated_by", "sent_at")
    list_filter = ("event_id", "status")


@admin.register(FinancialEntry)
class FinancialEntryAdmin(admin.ModelAdmin):
    """Entries can be added but never edited or deleted."""
    list_display = ("event_id", "code", "tactic_id", "stage", "amount", "entry_date", "reference", "created_by")
    list_filter = ("event_id", "stage")

    def has_change_permission(self, request, obj=None):
        return obj is None

    def has_delete_permission(self, request, obj=None):
        return False


@admin.register(AssistanceItem)
class AssistanceItemAdmin(admin.ModelAdmin):
    list_display = ("event_id", "code", "assistance_type", "description", "quantity", "provider", "status")
    list_filter = ("event_id", "assistance_type", "status")


@admin.register(FundingMix)
class FundingMixAdmin(admin.ModelAdmin):
    list_display = ("event_id", "government_pct", "local_gov_pct", "community_pct", "updated_at")


@admin.register(FinanceChange)
class FinanceChangeAdmin(admin.ModelAdmin):
    """Read-only: the audit log can be viewed but never edited or deleted."""
    list_display = ("at", "username", "action", "table", "record_code", "changed_fields")
    list_filter = ("event_id", "table", "action", "username")
    search_fields = ("record_code", "username")

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False
