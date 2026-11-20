from django.urls import path

from . import views

urlpatterns = [
    path("events/<str:event_id>/report/", views.report_view, name="finance-report"),
]
