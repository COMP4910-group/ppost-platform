"""
Finance API (all endpoints need the JWT login from /api/auth/login/).

GET /api/finance/events/<event_id>/report/              finance report JSON (format: finance/report_schema.json)
GET /api/finance/events/<event_id>/report/?download=1   same, as a file download
"""
import re

from rest_framework import status
from rest_framework.decorators import api_view
from rest_framework.response import Response

from .report import build_report

EVENT_RE = re.compile(r"^[A-Za-z0-9_-]{1,40}$")


@api_view(["GET"])
def report_view(request, event_id):
    if not EVENT_RE.match(event_id):
        return Response({"error": "Invalid event id."}, status=status.HTTP_400_BAD_REQUEST)
    response = Response(build_report(event_id, generated_by=request.user.get_username()))
    if request.query_params.get("download"):
        response["Content-Disposition"] = f'attachment; filename="finance_report_{event_id}.json"'
    return response
