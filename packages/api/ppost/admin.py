from django.contrib import admin

from .models import PpostChange, PpostRecord


@admin.register(PpostRecord)
class PpostRecordAdmin(admin.ModelAdmin):
    list_display = ("event_id", "kind", "record_id", "version", "is_deleted", "updated_by", "updated_at")
    list_filter = ("event_id", "kind", "is_deleted")
    search_fields = ("record_id",)


@admin.register(PpostChange)
class PpostChangeAdmin(admin.ModelAdmin):
    """Read-only: the audit log can be viewed but never edited or deleted."""
    list_display = ("at", "username", "action", "kind", "record_id", "version", "changed_fields")
    list_filter = ("event_id", "kind", "action", "username")
    search_fields = ("record_id", "username")

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False
