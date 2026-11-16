from django.urls import path

from . import views

urlpatterns = [
    path("events/<str:event_id>/state/", views.state_view, name="ppost-state"),
    path("events/<str:event_id>/changes/", views.changes_view, name="ppost-changes"),
    path("events/<str:event_id>/history/", views.history_view, name="ppost-history"),
]
