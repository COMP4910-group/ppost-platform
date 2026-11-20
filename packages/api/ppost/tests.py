from django.contrib.auth.models import User
from rest_framework.test import APITestCase

from .models import PpostChange, PpostRecord

EV = "EV-2026-014"
URL = f"/api/ppost/events/{EV}"


class PpostApiTests(APITestCase):
    def setUp(self):
        self.alice = User.objects.create_user("alice", password="pw")
        self.bob = User.objects.create_user("bob", password="pw")
        self.client.force_authenticate(self.alice)

    def post(self, *changes):
        return self.client.post(f"{URL}/changes/", {"changes": list(changes)}, format="json")

    def test_requires_login(self):
        self.client.force_authenticate(None)
        self.assertEqual(self.client.get(f"{URL}/state/").status_code, 401)
        self.assertEqual(self.post({"kind": "tactic", "record_id": "T-1", "action": "upsert", "data": {}}).status_code, 401)

    def test_create_update_delete_are_logged_with_user_and_time(self):
        r = self.post({"kind": "tactic", "record_id": "T-014", "action": "upsert",
                       "data": {"title": "Install units", "status": "DRAFT", "fiveW1H": {"when": {"start": "2026-10-12"}}},
                       "client_at": "2026-11-14T18:00:00Z"})
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.data["applied"][0]["result"], "create")

        self.client.force_authenticate(self.bob)
        self.post({"kind": "tactic", "record_id": "T-014", "action": "upsert",
                   "data": {"title": "Install units", "status": "IN_REVIEW", "fiveW1H": {"when": {"start": "2026-10-15"}}}})
        self.post({"kind": "tactic", "record_id": "T-014", "action": "delete", "reason": "duplicate"})

        log = list(PpostChange.objects.filter(record_id="T-014").order_by("id"))
        self.assertEqual([c.action for c in log], ["create", "update", "delete"])
        self.assertEqual([c.username for c in log], ["alice", "bob", "bob"])
        self.assertEqual(log[1].changed_fields, ["fiveW1H.when.start", "status"])
        self.assertEqual(log[1].before["status"], "DRAFT")
        self.assertEqual(log[1].after["status"], "IN_REVIEW")
        self.assertIsNotNone(log[0].client_at)
        self.assertEqual(log[2].reason, "duplicate")
        self.assertTrue(all(c.at for c in log))
        self.assertTrue(PpostRecord.objects.get(record_id="T-014").is_deleted)

    def test_unchanged_upsert_does_not_add_history(self):
        op = {"kind": "answer", "record_id": "Q-W03", "action": "upsert", "data": {"answer": "UNKNOWN", "note": "x"}}
        self.post(op)
        r = self.post(op)
        self.assertEqual(r.data["applied"][0]["result"], "unchanged")
        self.assertEqual(PpostChange.objects.filter(record_id="Q-W03").count(), 1)

    def test_state_returns_current_records_only(self):
        self.post({"kind": "problem", "record_id": "P-01", "action": "upsert", "data": {"title": "A"}},
                  {"kind": "problem", "record_id": "P-02", "action": "upsert", "data": {"title": "B"}},
                  {"kind": "problem", "record_id": "P-02", "action": "delete"})
        r = self.client.get(f"{URL}/state/")
        self.assertEqual([x["record_id"] for x in r.data["records"]], ["P-01"])
        self.assertEqual(r.data["records"][0]["updated_by"], "alice")

    def test_deleted_record_can_be_restored(self):
        op = {"kind": "problem", "record_id": "P-03", "action": "upsert", "data": {"title": "C"}}
        self.post(op)
        self.post({"kind": "problem", "record_id": "P-03", "action": "delete"})
        r = self.post(op)
        self.assertEqual(r.data["applied"][0]["result"], "restore")

    def test_history_filters_and_newest_first(self):
        self.post({"kind": "answer", "record_id": "Q-H01", "action": "upsert", "data": {"answer": "YES"}})
        self.post({"kind": "answer", "record_id": "Q-H01", "action": "upsert", "data": {"answer": "NO"}})
        self.post({"kind": "answer", "record_id": "Q-H02", "action": "upsert", "data": {"answer": "YES"}})
        r = self.client.get(f"{URL}/history/", {"kind": "answer", "record_id": "Q-H01"})
        self.assertEqual([c["after"]["answer"] for c in r.data["changes"]], ["NO", "YES"])
        self.assertEqual(r.data["changes"][0]["user"], "alice")

    def test_validation(self):
        self.assertEqual(self.post({"kind": "nope", "record_id": "X", "action": "upsert", "data": {}}).status_code, 400)
        self.assertEqual(self.post({"kind": "tactic", "record_id": "bad id!", "action": "upsert", "data": {}}).status_code, 400)
        self.assertEqual(self.post({"kind": "tactic", "record_id": "T-1", "action": "upsert", "data": "x"}).status_code, 400)
        self.assertEqual(self.client.post(f"{URL}/changes/", {}, format="json").status_code, 400)
        self.assertEqual(self.client.get("/api/ppost/events/bad%20id/state/").status_code, 400)

    def test_batch_is_all_or_nothing(self):
        r = self.post({"kind": "problem", "record_id": "P-09", "action": "upsert", "data": {"title": "ok"}},
                      {"kind": "bogus", "record_id": "P-10", "action": "upsert", "data": {}})
        self.assertEqual(r.status_code, 400)
        self.assertFalse(PpostRecord.objects.filter(record_id="P-09").exists())
