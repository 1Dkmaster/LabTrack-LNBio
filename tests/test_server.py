import http.cookiejar
import json
import sys
import tempfile
import threading
import unittest
from pathlib import Path
from urllib.error import HTTPError
from urllib.request import HTTPCookieProcessor, Request, build_opener

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import server


PASSWORD = "correct-horse-battery-42"


class LabTrackAPITests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        server.AUTH_ENABLED = True
        cls.temp_dir = tempfile.TemporaryDirectory()
        cls.db_path = Path(cls.temp_dir.name) / "test.sqlite3"
        server.initialize_database(cls.db_path)
        cls.admin = server.create_user(
            "admin.test", "Test Administrator", "admin", PASSWORD, cls.db_path
        )
        cls.operator = server.create_user(
            "operator.test", "Test Operator", "operator", PASSWORD, cls.db_path
        )
        cls.technician = server.create_user(
            "tech.test", "Test Technician", "technical", PASSWORD, cls.db_path
        )
        cls.viewer = server.create_user(
            "viewer.test", "Test Viewer", "viewer", PASSWORD, cls.db_path
        )
        with server.connect_db(cls.db_path) as connection:
            for user in (cls.operator, cls.technician, cls.viewer):
                connection.execute(
                    "INSERT INTO equipment_access(user_id, equipment_tag) VALUES (?, ?)",
                    (user["id"], "LNB-BAL-001"),
                )
            connection.commit()
        cls.httpd = server.LabTrackServer(
            ("127.0.0.1", 0), server.Handler, cls.db_path
        )
        cls.port = cls.httpd.server_address[1]
        cls.thread = threading.Thread(target=cls.httpd.serve_forever, daemon=True)
        cls.thread.start()

    @classmethod
    def tearDownClass(cls):
        cls.httpd.shutdown()
        cls.httpd.server_close()
        cls.thread.join(timeout=3)
        cls.temp_dir.cleanup()

    def setUp(self):
        self.cookie_jar = http.cookiejar.CookieJar()
        self.client = build_opener(HTTPCookieProcessor(self.cookie_jar))
        self.origin = f"http://127.0.0.1:{self.port}"
        with server.connect_db(self.db_path) as connection:
            connection.execute("DELETE FROM activity_reviews")
            connection.execute("DELETE FROM activity_revisions")
            connection.execute("DELETE FROM activities")
            connection.execute("DELETE FROM sessions")
            row = connection.execute(
                "SELECT data_json FROM equipment WHERE tag = 'LNB-BAL-001'"
            ).fetchone()
            equipment = json.loads(row["data_json"])
            equipment.update(
                {
                    "status": "Não verificado",
                    "lastCleaning": "",
                    "lastInspection": "",
                    "lastCalibration": "",
                }
            )
            connection.execute(
                "UPDATE equipment SET data_json = ? WHERE tag = 'LNB-BAL-001'",
                (json.dumps(equipment, ensure_ascii=False),),
            )
            connection.commit()

    def request(self, method, path, body=None, expected_status=200):
        data = None if body is None else json.dumps(body).encode("utf-8")
        request = Request(self.origin + path, data=data, method=method)
        if data is not None:
            request.add_header("Content-Type", "application/json")
            request.add_header("Origin", self.origin)
        try:
            response = self.client.open(request, timeout=5)
        except HTTPError as error:
            response = error
        raw_response = response.read().decode("utf-8")
        try:
            payload = json.loads(raw_response)
        except json.JSONDecodeError:
            payload = {"body": raw_response}
        self.assertEqual(response.status, expected_status, payload)
        return payload, response

    def login(self, username):
        self.request(
            "POST",
            "/api/login",
            {"username": username, "password": PASSWORD},
        )

    def test_password_minimum_is_eight_characters(self):
        self.assertTrue(server.valid_password("a1b2c3d4"))
        self.assertFalse(server.valid_password("a1b2c3d"))
        with self.assertRaises(server.APIError):
            server.create_user(
                "short.password",
                "Short Password",
                "operator",
                "a1b2c3d",
                self.db_path,
            )

    def test_seeded_inventory_requires_authentication_and_static_files_are_limited(self):
        payload, _ = self.request("GET", "/api/health")
        self.assertEqual(payload, {"ok": True, "setupRequired": False, "authEnabled": True})
        payload, _ = self.request("GET", "/api/session")
        self.assertEqual(payload, {"user": None})
        self.request("GET", "/api/equipment", expected_status=401)
        self.login(self.operator["username"])
        payload, _ = self.request("GET", "/api/equipment")
        self.assertEqual([item["id"] for item in payload["equipment"]], ["LNB-BAL-001"])
        self.request("GET", "/server.py", expected_status=404)
        self.request("GET", "/data/test.sqlite3", expected_status=404)

    def test_activity_is_pending_until_another_authorized_user_approves(self):
        self.login(self.operator["username"])
        record = {
            "type": "Verificação",
            "status": "Atenção",
            "checklist": [{"description": "Conferir nivelamento", "result": "Realizado"}],
            "notes": "Registro de teste",
        }
        created, _ = self.request(
            "POST",
            "/api/activities",
            {"equipmentTag": "LNB-BAL-001", "record": record},
            expected_status=201,
        )
        activity = created["activity"]
        self.assertEqual(activity["reviewStatus"], "pending")
        self.assertEqual(activity["responsible"], self.operator["name"])
        equipment, _ = self.request("GET", "/api/equipment/LNB-BAL-001")
        self.assertEqual(equipment["equipment"]["status"], "Não verificado")

        self.request(
            "POST",
            f"/api/activities/{activity['id']}/review",
            {"decision": "approved", "comments": "Revisão por usuário operador"},
            expected_status=403,
        )
        self.request("POST", "/api/logout", {})
        self.login(self.technician["username"])
        self.request(
            "POST",
            f"/api/activities/{activity['id']}/review",
            {"decision": "approved", "comments": "Conferido"},
            expected_status=403,
        )
        self.request("POST", "/api/logout", {})
        self.login(self.admin["username"])
        reviewed, _ = self.request(
            "POST",
            f"/api/activities/{activity['id']}/review",
            {"decision": "approved", "comments": "Conferido"},
            expected_status=201,
        )
        self.assertEqual(reviewed["activity"]["reviewStatus"], "approved")
        equipment, _ = self.request("GET", "/api/equipment/LNB-BAL-001")
        self.assertEqual(equipment["equipment"]["status"], "Atenção")
        self.assertEqual(equipment["equipment"]["activities"][0]["reviews"][0]["reviewer"]["name"], self.admin["name"])

    def test_operator_cannot_manage_equipment_and_cannot_access_unassigned_tags(self):
        self.login(self.operator["username"])
        self.request(
            "POST",
            "/api/equipment",
            {"id": "TEST-002", "name": "Equipamento", "category": "Teste", "location": "Sala"},
            expected_status=403,
        )
        self.request("GET", "/api/equipment/LNB-EQP-001", expected_status=403)
        self.request("POST", "/api/logout", {})
        self.login(self.technician["username"])
        self.request(
            "POST",
            "/api/equipment",
            {"id": "TEST-002", "name": "Equipamento", "category": "Teste", "location": "Sala"},
            expected_status=403,
        )

    def test_requested_correction_is_versioned_before_reapproval(self):
        self.login(self.operator["username"])
        created, _ = self.request(
            "POST",
            "/api/activities",
            {
                "equipmentTag": "LNB-BAL-001",
                "record": {
                    "type": "Verificação",
                    "status": "Atenção",
                    "checklist": [{"description": "Conferência", "result": "Realizado"}],
                    "notes": "Versão inicial",
                },
            },
            expected_status=201,
        )
        activity_id = created["activity"]["id"]
        self.request("POST", "/api/logout", {})
        self.login(self.admin["username"])
        requested, _ = self.request(
            "POST",
            f"/api/activities/{activity_id}/review",
            {"decision": "changes_requested", "comments": "Detalhar o resultado"},
            expected_status=201,
        )
        self.assertEqual(requested["activity"]["reviewStatus"], "changes_requested")
        self.request(
            "POST",
            f"/api/activities/{activity_id}/review",
            {"decision": "approved", "comments": ""},
            expected_status=409,
        )
        self.request("POST", "/api/logout", {})
        self.login(self.operator["username"])
        revised, _ = self.request(
            "POST",
            f"/api/activities/{activity_id}/revisions",
            {
                "record": {
                    "type": "Manutenção",
                    "status": "Manutenção",
                    "checklist": [{"description": "Conferência detalhada", "result": "Realizado"}],
                    "notes": "Correção enviada",
                }
            },
            expected_status=201,
        )
        self.assertEqual(revised["activity"]["reviewStatus"], "pending")
        self.assertEqual(revised["activity"]["revisionNumber"], 1)
        self.assertEqual(revised["activity"]["reviews"][0]["decision"], "changes_requested")
        self.request("POST", "/api/logout", {})
        self.login(self.admin["username"])
        approved, _ = self.request(
            "POST",
            f"/api/activities/{activity_id}/review",
            {"decision": "approved", "comments": "Correção conferida"},
            expected_status=201,
        )
        self.assertEqual(approved["activity"]["reviewStatus"], "approved")
        equipment, _ = self.request("GET", "/api/equipment/LNB-BAL-001")
        self.assertEqual(equipment["equipment"]["status"], "Manutenção")
        self.assertEqual(equipment["equipment"]["activities"][0]["notes"], "Correção enviada")

    def test_spectator_can_read_but_cannot_write_or_manage(self):
        self.login(self.operator["username"])
        created, _ = self.request(
            "POST",
            "/api/activities",
            {
                "equipmentTag": "LNB-BAL-001",
                "record": {
                    "type": "Verificação",
                    "status": "Operacional",
                    "checklist": [{"description": "Conferir", "result": "Realizado"}],
                    "notes": "",
                },
            },
            expected_status=201,
        )
        self.request("POST", "/api/logout", {})
        self.login(self.viewer["username"])
        equipment, _ = self.request("GET", "/api/equipment")
        self.assertEqual([item["id"] for item in equipment["equipment"]], ["LNB-BAL-001"])
        self.request("GET", "/api/equipment/LNB-BAL-001")
        self.request(
            "PUT",
            "/api/equipment/LNB-BAL-001",
            {"status": "Operacional"},
            expected_status=403,
        )
        self.request(
            "POST",
            "/api/activities",
            {
                "equipmentTag": "LNB-BAL-001",
                "record": {
                    "type": "Verificação",
                    "status": "Operacional",
                    "checklist": [{"description": "Conferir", "result": "Realizado"}],
                    "notes": "",
                },
            },
            expected_status=403,
        )
        self.request(
            "POST",
            "/api/equipment",
            {"id": "TEST-003", "name": "Equipamento", "category": "Teste", "location": "Sala"},
            expected_status=403,
        )
        self.request("GET", "/api/users", expected_status=403)
        self.request("GET", "/api/audit", expected_status=403)
        self.request(
            "POST",
            f"/api/activities/{created['activity']['id']}/review",
            {"decision": "approved", "comments": ""},
            expected_status=403,
        )

    def test_master_edits_activity_as_audited_pending_revision(self):
        self.login(self.operator["username"])
        created, _ = self.request(
            "POST",
            "/api/activities",
            {
                "equipmentTag": "LNB-BAL-001",
                "record": {
                    "type": "Verificação",
                    "status": "Atenção",
                    "checklist": [{"description": "Conferir", "result": "Realizado"}],
                    "notes": "Original",
                },
            },
            expected_status=201,
        )
        activity_id = created["activity"]["id"]
        self.request("POST", "/api/logout", {})
        self.login(self.admin["username"])
        revised, _ = self.request(
            "POST",
            f"/api/activities/{activity_id}/revisions",
            {
                "record": {
                    "type": "Manutenção",
                    "status": "Manutenção",
                    "checklist": [{"description": "Conferir novamente", "result": "Realizado"}],
                    "notes": "Revisado pelo Administrador Máximo",
                },
            },
            expected_status=201,
        )
        self.assertEqual(revised["activity"]["reviewStatus"], "pending")
        self.assertEqual(revised["activity"]["revisionNumber"], 1)
        self.assertEqual(revised["activity"]["responsible"], self.operator["name"])
        self.assertEqual(revised["activity"]["reviews"][0]["decision"], "changes_requested")
        self.assertEqual(revised["activity"]["notes"], "Revisado pelo Administrador Máximo")
        self.request(
            "POST",
            f"/api/activities/{activity_id}/review",
            {"decision": "approved", "comments": "Edição conferida"},
            expected_status=201,
        )

    def test_master_manages_roles_resets_passwords_and_deactivates_accounts(self):
        self.login(self.operator["username"])
        self.request(
            "POST",
            "/api/users",
            {
                "username": "forbidden.admin",
                "name": "Forbidden Admin",
                "password": PASSWORD,
                "role": "admin",
            },
            expected_status=403,
        )
        self.request("POST", "/api/logout", {})
        self.login(self.admin["username"])
        created, _ = self.request(
            "POST",
            "/api/users",
            {
                "username": "managed.user",
                "name": "Managed User",
                "password": PASSWORD,
                "role": "operator",
                "equipmentTags": ["LNB-BAL-001"],
            },
            expected_status=201,
        )
        self.assertEqual(created["user"]["role"], "operator")

        target_cookie_jar = http.cookiejar.CookieJar()
        target_client = build_opener(HTTPCookieProcessor(target_cookie_jar))
        admin_client = self.client
        self.client = target_client
        self.login("managed.user")
        self.client = admin_client
        self.request(
            "PUT",
            "/api/users/managed.user",
            {
                "name": "Managed Viewer",
                "username": "managed.renamed",
                "role": "viewer",
                "password": "new-secure-password",
            },
        )

        self.client = target_client
        self.request("GET", "/api/session")
        self.request("GET", "/api/equipment", expected_status=401)
        self.request(
            "POST",
            "/api/login",
            {"username": "managed.renamed", "password": "new-secure-password"},
        )
        self.request(
            "POST",
            "/api/activities",
            {
                "equipmentTag": "LNB-BAL-001",
                "record": {
                    "type": "Verificação",
                    "status": "Operacional",
                    "checklist": [{"description": "Conferir", "result": "Realizado"}],
                    "notes": "",
                },
            },
            expected_status=403,
        )
        self.client = admin_client
        self.request("DELETE", "/api/users/managed.renamed", {})
        self.client = target_client
        self.request(
            "POST",
            "/api/login",
            {"username": "managed.renamed", "password": "new-secure-password"},
            expected_status=401,
        )
        self.request("GET", "/api/equipment", expected_status=401)
        self.client = admin_client
        users, _ = self.request("GET", "/api/users")
        managed = next(user for user in users["users"] if user["username"] == "managed.renamed")
        self.assertFalse(managed["active"])
        self.assertEqual(managed["role"], "viewer")
        self.assertEqual(managed["name"], "Managed Viewer")
        self.request("GET", "/api/audit")

    def test_master_cannot_demote_or_disable_own_account(self):
        self.login(self.admin["username"])
        self.request(
            "PUT",
            f"/api/users/{self.admin['username']}",
            {"role": "operator"},
            expected_status=409,
        )
        self.request(
            "DELETE",
            f"/api/users/{self.admin['username']}",
            {},
            expected_status=409,
        )

    def test_database_audit_log_rejects_mutation(self):
        with server.connect_db(self.db_path) as connection:
            row = connection.execute("SELECT id FROM audit_log LIMIT 1").fetchone()
            self.assertIsNotNone(row)
            with self.assertRaises(Exception):
                connection.execute(
                    "UPDATE audit_log SET action = 'alterado' WHERE id = ?",
                    (row["id"],),
                )
            connection.rollback()

    def test_backup_creates_a_readable_sqlite_copy(self):
        destination = Path(self.temp_dir.name) / "backup.sqlite3"
        result = server.backup_database(destination, self.db_path)
        self.assertEqual(result, destination)
        with server.connect_db(result) as connection:
            count = connection.execute("SELECT COUNT(*) FROM equipment").fetchone()[0]
            self.assertEqual(count, len(server.INVENTORY))

    def test_local_mode_records_declared_names_as_unauthenticated(self):
        server.AUTH_ENABLED = False
        try:
            server.initialize_database(self.db_path)
            payload, _ = self.request("GET", "/api/health")
            self.assertEqual(payload["authEnabled"], False)
            self.assertFalse(payload["setupRequired"])

            session, _ = self.request("GET", "/api/session")
            self.assertFalse(session["user"]["authenticated"])
            self.assertIsNone(session["user"]["id"])
            self.request("GET", "/api/equipment")
            self.request(
                "POST",
                "/api/login",
                {"username": self.operator["username"], "password": PASSWORD},
                expected_status=404,
            )
            created, _ = self.request(
                "POST",
                "/api/activities",
                {
                    "equipmentTag": "LNB-BAL-001",
                    "record": {
                        "type": "Verificação",
                        "status": "Operacional",
                        "responsible": "Pessoa que declarou",
                        "checklist": [
                            {"description": "Conferência visual", "result": "Realizado"}
                        ],
                        "notes": "",
                    },
                },
                expected_status=201,
            )
            activity = created["activity"]
            self.assertEqual(activity["responsible"], "Pessoa que declarou")
            self.assertFalse(activity["actorAuthenticated"])
            self.assertIsNone(activity["actor"]["id"])

            reviewed, _ = self.request(
                "POST",
                f"/api/activities/{activity['id']}/review",
                {
                    "decision": "approved",
                    "comments": "",
                    "reviewerName": "Revisor declarado",
                },
                expected_status=201,
            )
            reviewer = reviewed["activity"]["reviews"][0]["reviewer"]
            self.assertEqual(reviewer["name"], "Revisor declarado")
            self.assertFalse(reviewer["authenticated"])
            self.assertIsNone(reviewer["id"])
            equipment, _ = self.request("GET", "/api/equipment/LNB-BAL-001")
            self.assertEqual(equipment["equipment"]["status"], "Não verificado")
        finally:
            server.AUTH_ENABLED = True

    def test_unauthenticated_server_rejects_non_loopback_bind_address(self):
        server.AUTH_ENABLED = False
        try:
            with self.assertRaises(SystemExit):
                server.serve("0.0.0.0", 0, self.db_path)
        finally:
            server.AUTH_ENABLED = True

    def test_first_admin_can_be_created_from_local_setup_page(self):
        previous_auth = server.AUTH_ENABLED
        previous_origin = self.origin
        previous_client = self.client
        setup_db = Path(self.temp_dir.name) / "first-admin.sqlite3"
        server.AUTH_ENABLED = True
        server.initialize_database(setup_db)
        httpd = server.LabTrackServer(
            ("127.0.0.1", 0), server.Handler, setup_db
        )
        thread = threading.Thread(target=httpd.serve_forever, daemon=True)
        thread.start()
        try:
            self.origin = f"http://127.0.0.1:{httpd.server_address[1]}"
            self.cookie_jar = http.cookiejar.CookieJar()
            self.client = build_opener(HTTPCookieProcessor(self.cookie_jar))
            health, _ = self.request("GET", "/api/health")
            self.assertTrue(health["authEnabled"])
            self.assertTrue(health["setupRequired"])

            created, _ = self.request(
                "POST",
                "/api/setup",
                {
                    "name": "First Administrator",
                    "username": "first.admin",
                    "password": "secure-local-password",
                },
                expected_status=201,
            )
            self.assertEqual(created["user"]["role"], "admin")
            self.assertEqual(created["user"]["username"], "first.admin")
            health, _ = self.request("GET", "/api/health")
            self.assertFalse(health["setupRequired"])
            self.request(
                "POST",
                "/api/setup",
                {
                    "name": "Another Administrator",
                    "username": "another.admin",
                    "password": "secure-local-password",
                },
                expected_status=409,
            )
            self.request(
                "POST",
                "/api/login",
                {
                    "username": "first.admin",
                    "password": "secure-local-password",
                },
            )
            session, _ = self.request("GET", "/api/session")
            self.assertEqual(session["user"]["role"], "admin")
        finally:
            httpd.shutdown()
            httpd.server_close()
            thread.join(timeout=3)
            self.origin = previous_origin
            self.client = previous_client
            server.AUTH_ENABLED = previous_auth


if __name__ == "__main__":
    unittest.main()
