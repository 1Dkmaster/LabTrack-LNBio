#!/usr/bin/env python3
"""Local LabTrack application server and SQLite API."""

from __future__ import annotations

import getpass
import hashlib
import hmac
import ipaddress
import json
import os
import re
import secrets
import socket
import sqlite3
import sys
import threading
import time
import uuid
from contextlib import contextmanager
from datetime import datetime, timedelta, timezone
from http import HTTPStatus
from http.cookies import CookieError, SimpleCookie
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import unquote, urlsplit


ROOT = Path(__file__).resolve().parent
DB_PATH = Path(os.environ.get("LABTRACK_DB_PATH", ROOT / "data" / "labtrack.sqlite3"))
AUTH_ENABLED = os.environ.get("LABTRACK_AUTH_ENABLED", "1").lower() not in {
    "0",
    "false",
    "no",
}
LOCAL_USER_ID = "local-unauthenticated-session"
SESSION_TTL_SECONDS = 8 * 60 * 60
PASSWORD_ITERATIONS = 600_000
MIN_PASSWORD_LENGTH = 8
MAX_REQUEST_BYTES = 1_048_576
MAX_LOGIN_ATTEMPTS = 5
LOGIN_WINDOW_SECONDS = 15 * 60
COOKIE_NAME = "labtrack_session"
ROLES = {"admin", "technical", "operator", "viewer"}
ROLE_NAMES = {
    "admin": "Administrador Máximo",
    "technical": "Operador/Técnico · Responsável técnico",
    "operator": "Operador/Técnico",
    "viewer": "Espectador",
}
LOGIN_ATTEMPTS: dict[str, list[float]] = {}
LOGIN_LOCK = threading.Lock()

INVENTORY = [
    ("LNB-BAL-001", "Balança Analítica AX223 - Ohaus", "Balança"),
    ("LNB-BAL-002", "Balança Analítica Pioneer - Ohaus", "Balança"),
    ("LNB-BAL-003", "Balança Analítica M214Ai - Bel", "Balança"),
    ("LNB-EQP-001", "Centrífuga 5810R - Eppendorf", "Centrífuga"),
    ("LNB-EQP-007", "Centrífuga MiniSpin C1008-P - Interprise", "Centrífuga"),
    ("LNB-EQP-033", "Centrífuga de placas Platefuge C2000- Benchmark", "Centrífuga"),
    ("LNB-EQP-053", "pHmetro Orion 720 - Thermo Scientific", "pHmetro"),
    ("LNB-EQP-067", "pHmetro Accumet AB15 - FisherBrand", "pHmetro"),
    ("LNB-EQP-147", "pHmetro Orion 420A+ - Thermo Scientific", "pHmetro"),
    ("LNB-VOX-001", "Agitador Vortex Standard - VWR", "Agitador vortex"),
    ("LNB-EQP-013", "Agitador magnético com aquecimento Isotemp - FisherBrand", "Agitador magnético"),
    ("LNB-AUT-001", "Autoclave vertical AV Plus - Phoenix Luferco", "Autoclave"),
    ("LNB-FRZ-001", "Freezer MDF-U333 - Sanyo", "Freezer"),
    ("LNB-MIC-001", "Microscópio Evos M5000 - Thermo Scientific", "Microscópio"),
    ("LNB-ESP-001", "Espectrofotômetro V-730 - Jasco", "Espectrofotômetro"),
    ("LNB-INC-001", "Incubadora CO2 3111 - Thermo Scientific", "Incubadora"),
    ("LNB-BOV-001", "Bomba de vácuo Diapump - Fanem", "Bomba de vácuo"),
    ("LNB-CSB-001", "Cabine de segurança biológica Biosafe A1 - Veco", "Cabine de segurança biológica"),
]


class APIError(Exception):
    def __init__(self, status: int, message: str):
        super().__init__(message)
        self.status = status


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="microseconds")


@contextmanager
def connect_db(db_path: Path = DB_PATH):
    db_path.parent.mkdir(parents=True, exist_ok=True)
    connection = sqlite3.connect(db_path, timeout=15)
    try:
        connection.row_factory = sqlite3.Row
        connection.execute("PRAGMA foreign_keys = ON")
        connection.execute("PRAGMA busy_timeout = 15000")
        yield connection
        connection.commit()
    except Exception:
        connection.rollback()
        raise
    finally:
        connection.close()


def initialize_database(db_path: Path = DB_PATH) -> None:
    with connect_db(db_path) as connection:
        connection.executescript(
            """
            PRAGMA journal_mode = WAL;
            CREATE TABLE IF NOT EXISTS users (
                id TEXT PRIMARY KEY,
                username TEXT NOT NULL UNIQUE COLLATE NOCASE,
                name TEXT NOT NULL,
                role TEXT NOT NULL CHECK (role IN ('admin', 'technical', 'operator')),
                password_hash BLOB NOT NULL,
                password_salt BLOB NOT NULL,
                active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
                created_at TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS user_roles (
                user_id TEXT PRIMARY KEY REFERENCES users(id),
                role TEXT NOT NULL CHECK (
                    role IN ('admin', 'technical', 'operator', 'viewer')
                )
            );
            CREATE TABLE IF NOT EXISTS equipment (
                tag TEXT PRIMARY KEY COLLATE NOCASE,
                data_json TEXT NOT NULL,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS equipment_access (
                user_id TEXT NOT NULL REFERENCES users(id),
                equipment_tag TEXT NOT NULL REFERENCES equipment(tag),
                PRIMARY KEY (user_id, equipment_tag)
            );
            CREATE TABLE IF NOT EXISTS sessions (
                token_hash BLOB PRIMARY KEY,
                user_id TEXT NOT NULL REFERENCES users(id),
                expires_at TEXT NOT NULL,
                created_at TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS activities (
                id TEXT PRIMARY KEY,
                equipment_tag TEXT NOT NULL REFERENCES equipment(tag),
                actor_id TEXT NOT NULL REFERENCES users(id),
                record_json TEXT NOT NULL,
                created_at TEXT NOT NULL
            );
            CREATE INDEX IF NOT EXISTS activities_by_equipment
                ON activities(equipment_tag, created_at);
            CREATE TABLE IF NOT EXISTS activity_reviews (
                id TEXT PRIMARY KEY,
                activity_id TEXT NOT NULL REFERENCES activities(id),
                reviewer_id TEXT NOT NULL REFERENCES users(id),
                reviewer_name TEXT NOT NULL DEFAULT '',
                reviewer_authenticated INTEGER NOT NULL DEFAULT 1 CHECK (
                    reviewer_authenticated IN (0, 1)
                ),
                decision TEXT NOT NULL CHECK (
                    decision IN ('approved', 'rejected', 'changes_requested')
                ),
                comments TEXT NOT NULL,
                created_at TEXT NOT NULL
            );
            CREATE INDEX IF NOT EXISTS reviews_by_activity
                ON activity_reviews(activity_id, created_at);
            CREATE TABLE IF NOT EXISTS activity_revisions (
                id TEXT PRIMARY KEY,
                activity_id TEXT NOT NULL REFERENCES activities(id),
                actor_id TEXT NOT NULL REFERENCES users(id),
                record_json TEXT NOT NULL,
                created_at TEXT NOT NULL
            );
            CREATE INDEX IF NOT EXISTS revisions_by_activity
                ON activity_revisions(activity_id, created_at);
            CREATE TABLE IF NOT EXISTS audit_log (
                id TEXT PRIMARY KEY,
                actor_id TEXT REFERENCES users(id),
                action TEXT NOT NULL,
                subject TEXT NOT NULL,
                details_json TEXT NOT NULL,
                remote_address TEXT NOT NULL,
                created_at TEXT NOT NULL
            );
            CREATE TRIGGER IF NOT EXISTS audit_log_no_update
            BEFORE UPDATE ON audit_log BEGIN
                SELECT RAISE(ABORT, 'audit_log is append-only');
            END;
            CREATE TRIGGER IF NOT EXISTS audit_log_no_delete
            BEFORE DELETE ON audit_log BEGIN
                SELECT RAISE(ABORT, 'audit_log is append-only');
            END;
            """
        )
        connection.execute(
            "INSERT OR IGNORE INTO user_roles(user_id, role) "
            "SELECT id, role FROM users"
        )
        review_columns = {
            column["name"]
            for column in connection.execute("PRAGMA table_info(activity_reviews)")
        }
        if "reviewer_name" not in review_columns:
            connection.execute(
                "ALTER TABLE activity_reviews ADD COLUMN reviewer_name TEXT NOT NULL DEFAULT ''"
            )
            connection.execute(
                "UPDATE activity_reviews SET reviewer_name = "
                "COALESCE((SELECT name FROM users WHERE id = reviewer_id), '')"
            )
        if "reviewer_authenticated" not in review_columns:
            connection.execute(
                "ALTER TABLE activity_reviews ADD COLUMN reviewer_authenticated "
                "INTEGER NOT NULL DEFAULT 1"
            )
        for tag, name, category in INVENTORY:
            exists = connection.execute(
                "SELECT 1 FROM equipment WHERE tag = ?", (tag,)
            ).fetchone()
            if not exists:
                now = utc_now()
                item = {
                    "id": tag,
                    "name": name,
                    "category": category,
                    "location": "Não informada na planilha",
                    "manufacturer": "Não informado separadamente na planilha",
                    "assetNumber": "Não informado",
                    "serial": "Não informado",
                    "acquisitionYear": "Não informado",
                    "status": "Não verificado",
                    "responsible": "Não informado",
                    "publicUrl": "",
                    "qrCode": f"QR-{tag}",
                    "lastCleaning": "",
                    "lastInspection": "",
                    "lastCalibration": "",
                    "nextCalibration": "",
                    "inventorySource": "Inventario_Tags_LNBIO_V3.xlsx",
                    "technical": {
                        "modelo": "Consultar nome/modelo do inventário",
                        "documentacao": "Não cadastrada",
                    },
                    "activities": [],
                }
                connection.execute(
                    "INSERT INTO equipment(tag, data_json, created_at, updated_at) "
                    "VALUES (?, ?, ?, ?)",
                    (tag, json.dumps(item, ensure_ascii=False), now, now),
                )
        if not AUTH_ENABLED:
            existing_local_user = connection.execute(
                "SELECT 1 FROM users WHERE id = ?", (LOCAL_USER_ID,)
            ).fetchone()
            if not existing_local_user:
                password_hash, password_salt = hash_password(secrets.token_urlsafe(32))
                connection.execute(
                    "INSERT INTO users(id, username, name, role, password_hash, "
                    "password_salt, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
                    (
                        LOCAL_USER_ID,
                        "local-unauthenticated",
                        "Acesso local sem autenticação",
                        "operator",
                        password_hash,
                        password_salt,
                        utc_now(),
                    ),
                )
                connection.execute(
                    "INSERT INTO user_roles(user_id, role) VALUES (?, 'operator')",
                    (LOCAL_USER_ID,),
                )
        connection.commit()
    try:
        if os.name != "nt":
            DB_PATH.parent.chmod(0o700)
            DB_PATH.chmod(0o600)
    except OSError:
        pass


def hash_password(password: str, salt: bytes | None = None) -> tuple[bytes, bytes]:
    salt = salt or secrets.token_bytes(16)
    derived = hashlib.pbkdf2_hmac(
        "sha256", password.encode("utf-8"), salt, PASSWORD_ITERATIONS
    )
    return derived, salt


def valid_password(password: str) -> bool:
    return MIN_PASSWORD_LENGTH <= len(password) <= 128 and "\x00" not in password


def create_user(
    username: str,
    name: str,
    role: str,
    password: str,
    db_path: Path = DB_PATH,
) -> dict:
    if not isinstance(username, str) or not isinstance(name, str):
        raise APIError(HTTPStatus.BAD_REQUEST, "Nome e usuário devem ser textos.")
    if not isinstance(role, str):
        raise APIError(HTTPStatus.BAD_REQUEST, "Perfil de acesso inválido.")
    if not isinstance(password, str):
        raise APIError(HTTPStatus.BAD_REQUEST, "Senha inválida.")
    with connect_db(db_path) as connection:
        user = create_user_in_connection(connection, username, name, role, password)
        connection.commit()
        return user


def create_user_in_connection(
    connection: sqlite3.Connection,
    username: str,
    name: str,
    role: str,
    password: str,
) -> dict:
    if not isinstance(username, str) or not isinstance(name, str):
        raise APIError(HTTPStatus.BAD_REQUEST, "Nome e usuário devem ser textos.")
    if not isinstance(role, str):
        raise APIError(HTTPStatus.BAD_REQUEST, "Perfil de acesso inválido.")
    if not isinstance(password, str):
        raise APIError(HTTPStatus.BAD_REQUEST, "Senha inválida.")
    username = username.strip().lower()
    name = name.strip()
    if not re.fullmatch(r"[a-z0-9][a-z0-9._-]{2,39}", username):
        raise APIError(
            HTTPStatus.BAD_REQUEST,
            "Usuário deve ter 3 a 40 caracteres: letras minúsculas, números, ponto, hífen ou sublinhado.",
        )
    if not name or len(name) > 120:
        raise APIError(HTTPStatus.BAD_REQUEST, "Informe um nome com até 120 caracteres.")
    if role not in ROLES:
        raise APIError(HTTPStatus.BAD_REQUEST, "Perfil de acesso inválido.")
    if not valid_password(password):
        raise APIError(HTTPStatus.BAD_REQUEST, "A senha deve ter entre 8 e 128 caracteres.")
    password_hash, salt = hash_password(password)
    user = {
        "id": str(uuid.uuid4()),
        "username": username,
        "name": name,
        "role": role,
        "createdAt": utc_now(),
    }
    database_role = "operator" if role == "viewer" else role
    try:
        connection.execute(
            "INSERT INTO users(id, username, name, role, password_hash, "
            "password_salt, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
            (
                user["id"],
                username,
                name,
                database_role,
                password_hash,
                salt,
                user["createdAt"],
            ),
        )
    except sqlite3.IntegrityError as error:
        raise APIError(HTTPStatus.CONFLICT, "Esse nome de usuário já existe.") from error
    connection.execute(
        "INSERT INTO user_roles(user_id, role) VALUES (?, ?)",
        (user["id"], role),
    )
    return user


def audit(
    connection: sqlite3.Connection,
    actor_id: str | None,
    action: str,
    subject: str,
    details: dict,
    remote_address: str,
) -> None:
    connection.execute(
        "INSERT INTO audit_log(id, actor_id, action, subject, details_json, "
        "remote_address, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
        (
            str(uuid.uuid4()),
            actor_id,
            action,
            subject,
            json.dumps(details, ensure_ascii=False, separators=(",", ":")),
            remote_address,
            utc_now(),
        ),
    )


def is_admin(user: dict) -> bool:
    return user["role"] == "admin"


def equipment_allowed(
    connection: sqlite3.Connection, user: dict, tag: str
) -> bool:
    if not AUTH_ENABLED:
        return True
    if is_admin(user):
        return True
    return (
        connection.execute(
            "SELECT 1 FROM equipment_access WHERE user_id = ? AND equipment_tag = ?",
            (user["id"], tag),
        ).fetchone()
        is not None
    )


def normalize_activity_record(
    record: dict, user: dict, responsible_override: str | None = None
) -> dict:
    if not isinstance(record, dict):
        raise APIError(HTTPStatus.BAD_REQUEST, "Registro da atividade inválido.")
    activity_type = record.get("type")
    status = record.get("status")
    allowed_types = {
        "Verificação", "Calibração diária", "Manutenção", "Limpeza",
        "Inspeção", "Observação", "Calibração",
    }
    allowed_status = {"Operacional", "Atenção", "Manutenção"}
    if (
        not isinstance(activity_type, str)
        or activity_type not in allowed_types
        or not isinstance(status, str)
        or status not in allowed_status
    ):
        raise APIError(HTTPStatus.BAD_REQUEST, "Tipo de atividade ou situação inválida.")
    checklist = record.get("checklist")
    if (
        not isinstance(checklist, list)
        or not checklist
        or len(checklist) > 100
        or any(
            not isinstance(item, dict)
            or not isinstance(item.get("description"), str)
            or not item["description"].strip()
            or len(item["description"]) > 240
            or not isinstance(item.get("result"), str)
            or item["result"] not in {"Realizado", "Não realizado", "Não se aplica"}
            for item in checklist
        )
    ):
        raise APIError(HTTPStatus.BAD_REQUEST, "Checklist inválido ou incompleto.")
    notes = record.get("notes", "")
    if not isinstance(notes, str) or len(notes) > 2000:
        raise APIError(HTTPStatus.BAD_REQUEST, "Observações inválidas.")
    if AUTH_ENABLED:
        responsible = responsible_override or user["name"]
    else:
        responsible = record.get("responsible", "")
        if not isinstance(responsible, str):
            raise APIError(HTTPStatus.BAD_REQUEST, "Informe o nome do responsável.")
        responsible = responsible.strip()
        if not responsible or len(responsible) > 120:
            raise APIError(HTTPStatus.BAD_REQUEST, "Informe um nome com até 120 caracteres.")
    return {
        "type": activity_type,
        "status": status,
        "responsible": responsible,
        "actorAuthenticated": AUTH_ENABLED,
        "checklist": [
            {"description": item["description"].strip(), "result": item["result"]}
            for item in checklist
        ],
        "notes": notes.strip(),
    }


def build_record(
    connection: sqlite3.Connection,
    activity_row: sqlite3.Row,
    user_cache: dict[str, dict] | None = None,
) -> dict:
    record = json.loads(activity_row["record_json"])
    original_responsible = record.get("responsible")
    original_authentication = record.get("actorAuthenticated")
    revisions = connection.execute(
        "SELECT r.record_json, r.created_at, u.id AS user_id, u.username, u.name "
        "FROM activity_revisions r JOIN users u ON u.id = r.actor_id "
        "WHERE r.activity_id = ? ORDER BY r.created_at, r.rowid",
        (activity_row["id"],),
    ).fetchall()
    if revisions:
        record.update(json.loads(revisions[-1]["record_json"]))
    record["revisionNumber"] = len(revisions)
    actor = connection.execute(
        "SELECT id, username, name, role FROM users WHERE id = ?",
        (activity_row["actor_id"],),
    ).fetchone()
    anonymous_actor = actor is not None and actor["id"] == LOCAL_USER_ID
    record["responsible"] = (
        original_responsible
        if isinstance(original_responsible, str) and original_responsible
        else actor["name"] if actor else "Usuário desativado"
    )
    record["actorAuthenticated"] = (
        bool(original_authentication)
        if original_authentication is not None
        else not anonymous_actor
    )
    record["actor"] = (
        {
            "id": None if anonymous_actor else actor["id"],
            "username": None if anonymous_actor else actor["username"],
            "name": record["responsible"] if anonymous_actor else actor["name"],
            "authenticated": not anonymous_actor,
        }
        if actor
        else None
    )
    reviews = connection.execute(
        "SELECT r.decision, r.comments, r.created_at, r.reviewer_name, "
        "r.reviewer_authenticated, u.id AS user_id, u.username, u.name "
        "FROM activity_reviews r JOIN users u ON u.id = r.reviewer_id "
        "WHERE r.activity_id = ? ORDER BY r.created_at, r.rowid",
        (activity_row["id"],),
    ).fetchall()
    record["reviews"] = [
        {
            "decision": review["decision"],
            "comments": review["comments"],
            "createdAt": review["created_at"],
            "reviewer": {
                "id": review["user_id"] if review["reviewer_authenticated"] else None,
                "username": review["username"] if review["reviewer_authenticated"] else None,
                "name": review["reviewer_name"] or review["name"],
                "authenticated": bool(review["reviewer_authenticated"]),
            },
        }
        for review in reviews
    ]
    latest_revision = revisions[-1] if revisions else None
    latest_review = reviews[-1] if reviews else None
    revised_after_request = (
        latest_review is not None
        and latest_review["decision"] == "changes_requested"
        and latest_revision is not None
        and latest_revision["created_at"] > latest_review["created_at"]
    )
    record["reviewStatus"] = (
        "pending"
        if revised_after_request
        else latest_review["decision"] if latest_review else "pending"
    )
    record["revisions"] = [
        {
            "createdAt": revision["created_at"],
            "actor": {
                "id": None if revision["user_id"] == LOCAL_USER_ID else revision["user_id"],
                "username": None if revision["user_id"] == LOCAL_USER_ID else revision["username"],
                "name": (
                    json.loads(revision["record_json"]).get("responsible", "Responsável não informado")
                    if revision["user_id"] == LOCAL_USER_ID
                    else revision["name"]
                ),
                "authenticated": revision["user_id"] != LOCAL_USER_ID,
            },
        }
        for revision in revisions
    ]
    record["id"] = activity_row["id"]
    record["createdAt"] = activity_row["created_at"]
    return record


def equipment_with_activities(
    connection: sqlite3.Connection, row: sqlite3.Row
) -> dict:
    item = json.loads(row["data_json"])
    activity_rows = connection.execute(
        "SELECT * FROM activities WHERE equipment_tag = ? "
        "ORDER BY created_at, id",
        (row["tag"],),
    ).fetchall()
    item["activities"] = [
        build_record(connection, activity) for activity in activity_rows
    ]
    return item


class LabTrackServer(ThreadingHTTPServer):
    daemon_threads = True
    allow_reuse_address = True

    def __init__(self, address, handler, db_path: Path):
        self.db_path = Path(db_path)
        super().__init__(address, handler)


class Handler(SimpleHTTPRequestHandler):
    server_version = "LabTrack"
    sys_version = ""

    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def log_message(self, format_string, *args):
        sys.stderr.write(
            "%s - %s\n"
            % (self.address_string(), format_string % args)
        )

    def send_json(self, status: int, payload: dict, extra_headers: dict | None = None):
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.send_header("Content-Security-Policy", "frame-ancestors 'none'")
        if extra_headers:
            for name, value in extra_headers.items():
                self.send_header(name, value)
        self.end_headers()
        self.wfile.write(body)

    def read_json(self) -> dict:
        try:
            length = int(self.headers.get("Content-Length", "0"))
        except ValueError as error:
            raise APIError(HTTPStatus.BAD_REQUEST, "Tamanho da solicitação inválido.") from error
        if length < 1 or length > MAX_REQUEST_BYTES:
            raise APIError(HTTPStatus.REQUEST_ENTITY_TOO_LARGE, "Solicitação vazia ou maior que 1 MB.")
        if self.headers.get_content_type() != "application/json":
            raise APIError(HTTPStatus.UNSUPPORTED_MEDIA_TYPE, "Envie dados como application/json.")
        try:
            value = json.loads(self.rfile.read(length))
        except (json.JSONDecodeError, UnicodeDecodeError) as error:
            raise APIError(HTTPStatus.BAD_REQUEST, "JSON inválido.") from error
        if not isinstance(value, dict):
            raise APIError(HTTPStatus.BAD_REQUEST, "O corpo deve ser um objeto JSON.")
        return value

    def check_origin(self) -> None:
        origin = self.headers.get("Origin")
        host = self.headers.get("Host", "")
        if not host:
            raise APIError(HTTPStatus.FORBIDDEN, "Host não autorizado.")
        allowed_hosts = {
            item.strip().lower()
            for item in os.environ.get(
                "LABTRACK_ALLOWED_HOSTS", "localhost,127.0.0.1"
            ).split(",")
            if item.strip()
        }
        hostname = host.rsplit(":", 1)[0].strip("[]").lower()
        if hostname not in allowed_hosts:
            raise APIError(HTTPStatus.FORBIDDEN, "Host não autorizado.")
        if not origin:
            raise APIError(HTTPStatus.FORBIDDEN, "Origem da solicitação não autorizada.")
        parsed = urlsplit(origin)
        if (
            parsed.scheme not in {"http", "https"}
            or parsed.netloc.lower() != host.lower()
            or parsed.path not in {"", "/"}
            or parsed.query
            or parsed.fragment
        ):
            raise APIError(HTTPStatus.FORBIDDEN, "Origem da solicitação não autorizada.")

    def session_user(self, connection: sqlite3.Connection) -> dict | None:
        if not AUTH_ENABLED:
            row = connection.execute(
                "SELECT u.id, u.username, u.name, r.role FROM users u "
                "JOIN user_roles r ON r.user_id = u.id "
                "WHERE u.id = ? AND u.active = 1",
                (LOCAL_USER_ID,),
            ).fetchone()
            return (
                {
                    "id": row["id"],
                    "username": row["username"],
                    "name": row["name"],
                    "role": row["role"],
                    "authenticated": False,
                }
                if row
                else None
            )
        cookie = SimpleCookie()
        try:
            cookie.load(self.headers.get("Cookie", ""))
        except CookieError:
            return None
        morsel = cookie.get(COOKIE_NAME)
        if not morsel:
            return None
        token_hash = hashlib.sha256(morsel.value.encode("ascii", "ignore")).digest()
        row = connection.execute(
            "SELECT u.id, u.username, u.name, r.role, s.expires_at "
            "FROM sessions s JOIN users u ON u.id = s.user_id "
            "JOIN user_roles r ON r.user_id = u.id "
            "WHERE s.token_hash = ? AND u.active = 1",
            (token_hash,),
        ).fetchone()
        if not row or row["expires_at"] <= utc_now():
            if row:
                connection.execute("DELETE FROM sessions WHERE token_hash = ?", (token_hash,))
                connection.commit()
            return None
        return {
            "id": row["id"],
            "username": row["username"],
            "name": row["name"],
            "role": row["role"],
            "authenticated": True,
        }

    def require_user(self, connection: sqlite3.Connection) -> dict:
        user = self.session_user(connection)
        if not user:
            raise APIError(HTTPStatus.UNAUTHORIZED, "Entre para continuar.")
        return user

    def handle_api(self):
        path = unquote(urlsplit(self.path).path)
        try:
            if path == "/api/health" and self.command == "GET":
                with connect_db(self.server.db_path) as connection:
                    setup_required = (
                        connection.execute(
                            "SELECT COUNT(*) FROM users u "
                            "JOIN user_roles r ON r.user_id = u.id "
                            "WHERE r.role = 'admin' AND u.active = 1"
                        ).fetchone()[0]
                        == 0
                    )
                self.send_json(
                    HTTPStatus.OK,
                    {
                        "ok": True,
                        "setupRequired": setup_required if AUTH_ENABLED else False,
                        "authEnabled": AUTH_ENABLED,
                    },
                )
                return

            if self.command in {"POST", "PUT", "PATCH", "DELETE"}:
                self.check_origin()

            if path == "/api/setup" and self.command == "POST":
                self.create_first_admin()
                return

            if path == "/api/login" and self.command == "POST":
                if not AUTH_ENABLED:
                    raise APIError(HTTPStatus.NOT_FOUND, "Endpoint não encontrado.")
                self.login()
                return

            with connect_db(self.server.db_path) as connection:
                if path == "/api/session" and self.command == "GET":
                    user = self.session_user(connection)
                    if not user:
                        self.send_json(HTTPStatus.OK, {"user": None})
                        return
                    self.send_json(HTTPStatus.OK, {"user": self.public_user(user)})
                    return

                if path == "/api/logout" and self.command == "POST":
                    cookie = SimpleCookie()
                    try:
                        cookie.load(self.headers.get("Cookie", ""))
                    except CookieError:
                        cookie = SimpleCookie()
                    morsel = cookie.get(COOKIE_NAME)
                    if morsel:
                        token_hash = hashlib.sha256(
                            morsel.value.encode("ascii", "ignore")
                        ).digest()
                        session = connection.execute(
                            "SELECT user_id FROM sessions WHERE token_hash = ?",
                            (token_hash,),
                        ).fetchone()
                        connection.execute(
                            "DELETE FROM sessions WHERE token_hash = ?", (token_hash,)
                        )
                        if session:
                            audit(
                                connection,
                                session["user_id"],
                                "logout",
                                session["user_id"],
                                {},
                                self.client_address[0],
                            )
                        connection.commit()
                    self.send_json(
                        HTTPStatus.OK,
                        {"ok": True},
                        {"Set-Cookie": self.cookie_header("", max_age=0)},
                    )
                    return

                user = self.require_user(connection)
                if path == "/api/equipment" and self.command == "GET":
                    rows = connection.execute(
                        "SELECT * FROM equipment ORDER BY tag COLLATE NOCASE"
                    ).fetchall()
                    items = [
                        equipment_with_activities(connection, row)
                        for row in rows
                        if equipment_allowed(connection, user, row["tag"])
                    ]
                    self.send_json(HTTPStatus.OK, {"equipment": items})
                    return

                if path == "/api/equipment" and self.command == "POST":
                    self.create_equipment(connection, user)
                    return

                if path.startswith("/api/equipment/"):
                    self.equipment_route(connection, user, path)
                    return

                if path == "/api/activities" and self.command == "POST":
                    self.create_activity(connection, user)
                    return

                if path.startswith("/api/activities/") and path.endswith("/revisions"):
                    self.create_activity_revision(connection, user, path)
                    return

                if path.startswith("/api/activities/"):
                    self.review_activity(connection, user, path)
                    return

                if path == "/api/users" and self.command in {"GET", "POST"}:
                    self.users_route(connection, user)
                    return

                if path.startswith("/api/users/") and self.command in {"PUT", "DELETE"}:
                    self.user_access_route(connection, user, path)
                    return

                if path == "/api/audit" and self.command == "GET":
                    if not is_admin(user):
                        raise APIError(HTTPStatus.FORBIDDEN, "Apenas administradores podem consultar auditoria.")
                    rows = connection.execute(
                        "SELECT a.id, a.action, a.subject, a.details_json, "
                        "a.remote_address, a.created_at, u.username, u.name "
                        "FROM audit_log a LEFT JOIN users u ON u.id = a.actor_id "
                        "ORDER BY a.created_at DESC LIMIT 200"
                    ).fetchall()
                    events = [
                        {
                            "id": row["id"],
                            "action": row["action"],
                            "subject": row["subject"],
                            "details": json.loads(row["details_json"]),
                            "remoteAddress": row["remote_address"],
                            "createdAt": row["created_at"],
                            "actor": row["username"],
                            "actorName": row["name"],
                        }
                        for row in rows
                    ]
                    self.send_json(HTTPStatus.OK, {"events": events})
                    return

                raise APIError(HTTPStatus.NOT_FOUND, "Endpoint não encontrado.")
        except APIError as error:
            self.send_json(error.status, {"error": str(error)})
        except sqlite3.IntegrityError as error:
            self.send_json(HTTPStatus.CONFLICT, {"error": "A operação conflita com os dados existentes."})
            sys.stderr.write(f"Integridade do banco rejeitou solicitação: {error}\n")
        except Exception:
            sys.stderr.write(f"Erro interno ao processar {self.command} {path}\n")
            self.send_json(
                HTTPStatus.INTERNAL_SERVER_ERROR,
                {"error": "Erro interno. Consulte o log do servidor."},
            )

    @staticmethod
    def public_user(user: dict) -> dict:
        authenticated = user.get("authenticated", True)
        return {
            "id": user["id"] if authenticated else None,
            "username": user["username"] if authenticated else None,
            "name": user["name"],
            "role": user["role"],
            "roleName": ROLE_NAMES[user["role"]],
            "authenticated": authenticated,
        }

    def create_first_admin(self):
        if not AUTH_ENABLED:
            raise APIError(HTTPStatus.NOT_FOUND, "Endpoint não encontrado.")
        try:
            remote_address = ipaddress.ip_address(
                self.client_address[0].split("%", 1)[0]
            )
        except ValueError as error:
            raise APIError(HTTPStatus.FORBIDDEN, "Configuração inicial permitida apenas localmente.") from error
        if not remote_address.is_loopback:
            raise APIError(HTTPStatus.FORBIDDEN, "Configuração inicial permitida apenas localmente.")

        body = self.read_json()
        with connect_db(self.server.db_path) as connection:
            connection.execute("BEGIN IMMEDIATE")
            has_admin = connection.execute(
                "SELECT 1 FROM users u JOIN user_roles r ON r.user_id = u.id "
                "WHERE r.role = 'admin' AND u.active = 1 LIMIT 1"
            ).fetchone()
            if has_admin:
                raise APIError(HTTPStatus.CONFLICT, "A conta inicial já foi criada.")
            created = create_user_in_connection(
                connection,
                body.get("username", ""),
                body.get("name", ""),
                "admin",
                body.get("password", ""),
            )
            audit(
                connection,
                created["id"],
                "admin.initialized",
                created["username"],
                {},
                self.client_address[0],
            )
            connection.commit()
        self.send_json(
            HTTPStatus.CREATED,
            {"user": {**created, "roleName": ROLE_NAMES["admin"]}},
        )

    def cookie_header(self, token: str, max_age: int = SESSION_TTL_SECONDS) -> str:
        parts = [
            f"{COOKIE_NAME}={token}",
            "Path=/",
            "HttpOnly",
            "SameSite=Strict",
            f"Max-Age={max_age}",
        ]
        if os.environ.get("LABTRACK_COOKIE_SECURE") == "1":
            parts.append("Secure")
        return "; ".join(parts)

    def login(self):
        body = self.read_json()
        username = body.get("username", "")
        password = body.get("password", "")
        if (
            not isinstance(username, str)
            or not isinstance(password, str)
            or len(username) > 40
            or len(password) > 128
        ):
            raise APIError(HTTPStatus.BAD_REQUEST, "Credenciais inválidas.")
        username = username.strip().lower()
        remote = self.client_address[0]
        attempt_key = remote
        now = time.time()
        with LOGIN_LOCK:
            recent = [
                attempt
                for attempt in LOGIN_ATTEMPTS.get(attempt_key, [])
                if now - attempt < LOGIN_WINDOW_SECONDS
            ]
            if len(recent) >= MAX_LOGIN_ATTEMPTS:
                raise APIError(HTTPStatus.TOO_MANY_REQUESTS, "Muitas tentativas. Tente novamente mais tarde.")
            recent.append(now)
            LOGIN_ATTEMPTS[attempt_key] = recent

        with connect_db(self.server.db_path) as connection:
            row = connection.execute(
                "SELECT u.id, u.username, u.name, r.role, u.password_hash, "
                "u.password_salt, u.active FROM users u "
                "JOIN user_roles r ON r.user_id = u.id "
                "WHERE u.username = ? COLLATE NOCASE",
                (username,),
            ).fetchone()
            candidate, _ = hash_password(
                password if isinstance(password, str) else "", row["password_salt"] if row else b"\0" * 16
            )
            if (
                not row
                or not row["active"]
                or not hmac.compare_digest(candidate, row["password_hash"])
            ):
                audit(
                    connection,
                    row["id"] if row else None,
                    "login.failed",
                    username[:40],
                    {"reason": "invalid_credentials"},
                    remote,
                )
                connection.commit()
                raise APIError(HTTPStatus.UNAUTHORIZED, "Usuário ou senha incorretos.")
            token = secrets.token_urlsafe(32)
            token_hash = hashlib.sha256(token.encode("ascii")).digest()
            expires_at = (datetime.now(timezone.utc) + timedelta(seconds=SESSION_TTL_SECONDS)).isoformat(timespec="seconds")
            connection.execute(
                "INSERT INTO sessions(token_hash, user_id, expires_at, created_at) "
                "VALUES (?, ?, ?, ?)",
                (token_hash, row["id"], expires_at, utc_now()),
            )
            audit(
                connection,
                row["id"],
                "login",
                row["username"],
                {},
                remote,
            )
            connection.commit()
        with LOGIN_LOCK:
            LOGIN_ATTEMPTS.pop(attempt_key, None)
        self.send_json(
            HTTPStatus.OK,
            {
                "user": self.public_user(
                    {
                        "id": row["id"],
                        "username": row["username"],
                        "name": row["name"],
                        "role": row["role"],
                    }
                )
            },
            {"Set-Cookie": self.cookie_header(token)},
        )

    def create_equipment(self, connection: sqlite3.Connection, user: dict):
        if not is_admin(user):
            raise APIError(HTTPStatus.FORBIDDEN, "Somente administradores podem cadastrar equipamentos.")
        body = self.read_json()
        raw_tag = body.get("id", "")
        if not isinstance(raw_tag, str):
            raise APIError(HTTPStatus.BAD_REQUEST, "Informe uma TAG válida.")
        tag = raw_tag.strip().upper()
        if not re.fullmatch(r"[A-Z0-9][A-Z0-9._-]{1,59}", tag):
            raise APIError(HTTPStatus.BAD_REQUEST, "Informe uma TAG válida de 2 a 60 caracteres.")
        required = ("name", "category", "location")
        for field in required:
            if not isinstance(body.get(field), str) or not body[field].strip():
                raise APIError(HTTPStatus.BAD_REQUEST, f"O campo {field} é obrigatório.")
        item = {
            "id": tag,
            "name": body["name"].strip()[:160],
            "category": body["category"].strip()[:80],
            "location": body["location"].strip()[:120],
            "manufacturer": str(body.get("manufacturer") or "Não informado").strip()[:120],
            "assetNumber": str(body.get("assetNumber") or "Não informado").strip()[:80],
            "serial": str(body.get("serial") or "Não informado").strip()[:80],
            "acquisitionYear": str(body.get("acquisitionYear") or "Não informado").strip()[:30],
            "status": "Não verificado",
            "responsible": user["name"],
            "publicUrl": "",
            "qrCode": f"QR-{tag}",
            "lastCleaning": "",
            "lastInspection": "",
            "lastCalibration": "",
            "nextCalibration": "",
            "technical": body.get("technical") if isinstance(body.get("technical"), dict) else {},
            "activities": [],
        }
        now = utc_now()
        connection.execute(
            "INSERT INTO equipment(tag, data_json, created_at, updated_at) VALUES (?, ?, ?, ?)",
            (tag, json.dumps(item, ensure_ascii=False), now, now),
        )
        audit(
            connection,
            user["id"],
            "equipment.created",
            tag,
            {"name": item["name"]},
            self.client_address[0],
        )
        connection.commit()
        self.send_json(HTTPStatus.CREATED, {"equipment": item})

    def equipment_route(
        self, connection: sqlite3.Connection, user: dict, path: str
    ):
        parts = path.split("/")
        if len(parts) != 4 or not parts[3]:
            raise APIError(HTTPStatus.NOT_FOUND, "Equipamento não encontrado.")
        tag = parts[3].upper()
        row = connection.execute(
            "SELECT * FROM equipment WHERE tag = ? COLLATE NOCASE", (tag,)
        ).fetchone()
        if not row:
            raise APIError(HTTPStatus.NOT_FOUND, "Equipamento não encontrado.")
        if not equipment_allowed(connection, user, tag):
            raise APIError(HTTPStatus.FORBIDDEN, "Você não tem acesso a este equipamento.")
        if self.command == "GET":
            self.send_json(
                HTTPStatus.OK,
                {"equipment": equipment_with_activities(connection, row)},
            )
            return
        if self.command == "PUT":
            if not is_admin(user):
                raise APIError(HTTPStatus.FORBIDDEN, "Somente administradores podem alterar dados técnicos.")
            body = self.read_json()
            current = json.loads(row["data_json"])
            editable = {
                "name", "category", "location", "manufacturer", "assetNumber",
                "serial", "acquisitionYear", "status", "responsible",
                "lastCleaning", "lastInspection", "lastCalibration",
                "nextCalibration", "technical",
            }
            updated = {key: value for key, value in current.items() if key != "activities"}
            for key in editable.intersection(body):
                updated[key] = body[key]
            updated["id"] = tag
            changes = {
                key: {"from": current.get(key), "to": updated.get(key)}
                for key in editable.intersection(body)
                if current.get(key) != updated.get(key)
            }
            now = utc_now()
            connection.execute(
                "UPDATE equipment SET data_json = ?, updated_at = ? WHERE tag = ?",
                (json.dumps(updated, ensure_ascii=False), now, tag),
            )
            audit(
                connection,
                user["id"],
                "equipment.updated",
                tag,
                {"changes": changes},
                self.client_address[0],
            )
            connection.commit()
            updated["activities"] = equipment_with_activities(connection, row)["activities"]
            self.send_json(HTTPStatus.OK, {"equipment": updated})
            return
        raise APIError(HTTPStatus.METHOD_NOT_ALLOWED, "Método não permitido.")

    def create_activity(self, connection: sqlite3.Connection, user: dict):
        if AUTH_ENABLED and user["role"] == "viewer":
            raise APIError(HTTPStatus.FORBIDDEN, "O perfil espectador tem acesso somente para consulta.")
        body = self.read_json()
        raw_tag = body.get("equipmentTag", "")
        if not isinstance(raw_tag, str):
            raise APIError(HTTPStatus.BAD_REQUEST, "TAG do equipamento inválida.")
        tag = raw_tag.strip().upper()
        if not tag:
            raise APIError(HTTPStatus.BAD_REQUEST, "TAG do equipamento obrigatória.")
        equipment = connection.execute(
            "SELECT * FROM equipment WHERE tag = ? COLLATE NOCASE", (tag,)
        ).fetchone()
        if not equipment:
            raise APIError(HTTPStatus.NOT_FOUND, "Equipamento não encontrado.")
        if not equipment_allowed(connection, user, tag):
            raise APIError(HTTPStatus.FORBIDDEN, "Você não tem acesso a este equipamento.")
        saved = normalize_activity_record(body.get("record"), user)
        activity_id = str(uuid.uuid4())
        now = utc_now()
        connection.execute(
            "INSERT INTO activities(id, equipment_tag, actor_id, record_json, created_at) "
            "VALUES (?, ?, ?, ?, ?)",
            (
                activity_id,
                tag,
                user["id"],
                json.dumps(saved, ensure_ascii=False),
                now,
            ),
        )
        audit(
            connection,
            user["id"],
            "activity.submitted",
            activity_id,
            {
                "equipmentTag": tag,
                "type": saved["type"],
                "responsible": saved["responsible"],
                "authenticated": AUTH_ENABLED,
            },
            self.client_address[0],
        )
        connection.commit()
        row = connection.execute(
            "SELECT * FROM activities WHERE id = ?", (activity_id,)
        ).fetchone()
        self.send_json(
            HTTPStatus.CREATED,
            {"activity": build_record(connection, row)},
        )

    def create_activity_revision(
        self, connection: sqlite3.Connection, user: dict, path: str
    ):
        if AUTH_ENABLED and user["role"] == "viewer":
            raise APIError(HTTPStatus.FORBIDDEN, "O perfil espectador tem acesso somente para consulta.")
        if self.command != "POST":
            raise APIError(HTTPStatus.METHOD_NOT_ALLOWED, "Método não permitido.")
        parts = path.split("/")
        if len(parts) != 5 or not parts[3]:
            raise APIError(HTTPStatus.NOT_FOUND, "Atividade não encontrada.")
        activity_id = parts[3]
        activity = connection.execute(
            "SELECT * FROM activities WHERE id = ?", (activity_id,)
        ).fetchone()
        if not activity:
            raise APIError(HTTPStatus.NOT_FOUND, "Atividade não encontrada.")
        is_admin_edit = AUTH_ENABLED and is_admin(user)
        if not is_admin_edit and activity["actor_id"] != user["id"]:
            raise APIError(HTTPStatus.FORBIDDEN, "Somente quem registrou pode enviar a correção.")
        if not equipment_allowed(connection, user, activity["equipment_tag"]):
            raise APIError(HTTPStatus.FORBIDDEN, "Você não tem acesso a este equipamento.")
        latest_review = connection.execute(
            "SELECT decision, created_at FROM activity_reviews "
            "WHERE activity_id = ? ORDER BY created_at DESC, rowid DESC LIMIT 1",
            (activity_id,),
        ).fetchone()
        latest_revision = connection.execute(
            "SELECT created_at FROM activity_revisions "
            "WHERE activity_id = ? ORDER BY created_at DESC, rowid DESC LIMIT 1",
            (activity_id,),
        ).fetchone()
        if not is_admin_edit and (
            not latest_review
            or latest_review["decision"] != "changes_requested"
            or (
                latest_revision
                and latest_revision["created_at"] > latest_review["created_at"]
            )
        ):
            raise APIError(HTTPStatus.CONFLICT, "Não há solicitação de correção pendente.")
        body = self.read_json()
        current_record = connection.execute(
            "SELECT record_json FROM activity_revisions WHERE activity_id = ? "
            "ORDER BY created_at DESC, rowid DESC LIMIT 1",
            (activity_id,),
        ).fetchone()
        if not current_record:
            current_record = {"record_json": activity["record_json"]}
        previous_record = json.loads(current_record["record_json"])
        record = normalize_activity_record(
            body.get("record"),
            user,
            previous_record.get("responsible") if is_admin_edit else None,
        )
        revision_id = str(uuid.uuid4())
        now = utc_now()
        if is_admin_edit and (
            not latest_review or latest_review["decision"] != "changes_requested"
        ):
            connection.execute(
                "INSERT INTO activity_reviews(id, activity_id, reviewer_id, reviewer_name, "
                "reviewer_authenticated, decision, comments, created_at) "
                "VALUES (?, ?, ?, ?, 1, 'changes_requested', ?, ?)",
                (
                    str(uuid.uuid4()),
                    activity_id,
                    user["id"],
                    user["name"],
                    "Edição administrativa registrada; a nova versão aguarda aprovação.",
                    now,
                ),
            )
            now = (
                datetime.fromisoformat(now) + timedelta(microseconds=1)
            ).isoformat(timespec="microseconds")
        connection.execute(
            "INSERT INTO activity_revisions(id, activity_id, actor_id, record_json, "
            "created_at) VALUES (?, ?, ?, ?, ?)",
            (
                revision_id,
                activity_id,
                user["id"],
                json.dumps(record, ensure_ascii=False),
                now,
            ),
        )
        audit(
            connection,
            user["id"],
            "activity.admin_edited" if is_admin_edit else "activity.corrected",
            activity_id,
            {
                "revisionId": revision_id,
                "equipmentTag": activity["equipment_tag"],
                "responsible": record["responsible"],
                "authenticated": AUTH_ENABLED,
            },
            self.client_address[0],
        )
        connection.commit()
        updated = connection.execute(
            "SELECT * FROM activities WHERE id = ?", (activity_id,)
        ).fetchone()
        self.send_json(
            HTTPStatus.CREATED,
            {"activity": build_record(connection, updated)},
        )

    def review_activity(
        self, connection: sqlite3.Connection, user: dict, path: str
    ):
        if self.command != "POST" or not path.endswith("/review"):
            raise APIError(HTTPStatus.NOT_FOUND, "Endpoint não encontrado.")
        if AUTH_ENABLED and not is_admin(user):
            raise APIError(HTTPStatus.FORBIDDEN, "Somente o Administrador Máximo pode revisar atividades.")
        parts = path.split("/")
        if len(parts) != 5 or not parts[3]:
            raise APIError(HTTPStatus.NOT_FOUND, "Atividade não encontrada.")
        activity_id = parts[3]
        activity = connection.execute(
            "SELECT * FROM activities WHERE id = ?", (activity_id,)
        ).fetchone()
        if not activity:
            raise APIError(HTTPStatus.NOT_FOUND, "Atividade não encontrada.")
        if AUTH_ENABLED and activity["actor_id"] == user["id"]:
            raise APIError(HTTPStatus.FORBIDDEN, "Quem registrou a atividade não pode aprová-la.")
        if not equipment_allowed(connection, user, activity["equipment_tag"]):
            raise APIError(HTTPStatus.FORBIDDEN, "Você não tem acesso a este equipamento.")
        latest = connection.execute(
            "SELECT decision, created_at FROM activity_reviews WHERE activity_id = ? "
            "ORDER BY created_at DESC, rowid DESC LIMIT 1",
            (activity_id,),
        ).fetchone()
        if latest and latest["decision"] != "changes_requested":
            raise APIError(HTTPStatus.CONFLICT, "Esta atividade já recebeu uma decisão final.")
        if latest:
            revision = connection.execute(
                "SELECT created_at FROM activity_revisions WHERE activity_id = ? "
                "ORDER BY created_at DESC, rowid DESC LIMIT 1",
                (activity_id,),
            ).fetchone()
            if not revision or revision["created_at"] <= latest["created_at"]:
                raise APIError(
                    HTTPStatus.CONFLICT,
                    "Aguarde o envio da correção solicitada antes de uma nova revisão.",
                )
        body = self.read_json()
        decision = body.get("decision")
        comments = body.get("comments", "")
        if not isinstance(decision, str) or decision not in {"approved", "rejected", "changes_requested"}:
            raise APIError(HTTPStatus.BAD_REQUEST, "Decisão de revisão inválida.")
        if not isinstance(comments, str) or len(comments) > 2000:
            raise APIError(HTTPStatus.BAD_REQUEST, "Comentário inválido.")
        if decision != "approved" and not comments.strip():
            raise APIError(HTTPStatus.BAD_REQUEST, "Informe o motivo da decisão.")
        if AUTH_ENABLED:
            reviewer_name = user["name"]
        else:
            reviewer_name = body.get("reviewerName", "")
            if not isinstance(reviewer_name, str):
                raise APIError(HTTPStatus.BAD_REQUEST, "Informe o nome do revisor.")
            reviewer_name = reviewer_name.strip()
            if not reviewer_name or len(reviewer_name) > 120:
                raise APIError(HTTPStatus.BAD_REQUEST, "Informe um nome com até 120 caracteres.")
        review_id = str(uuid.uuid4())
        now = utc_now()
        connection.execute(
            "INSERT INTO activity_reviews(id, activity_id, reviewer_id, reviewer_name, "
            "reviewer_authenticated, decision, comments, created_at) "
            "VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
            (
                review_id,
                activity_id,
                user["id"],
                reviewer_name,
                int(AUTH_ENABLED),
                decision,
                comments.strip(),
                now,
            ),
        )
        if decision == "approved" and AUTH_ENABLED:
            equipment = connection.execute(
                "SELECT data_json FROM equipment WHERE tag = ?",
                (activity["equipment_tag"],),
            ).fetchone()
            data = json.loads(equipment["data_json"])
            record = json.loads(activity["record_json"])
            revision = connection.execute(
                "SELECT record_json FROM activity_revisions WHERE activity_id = ? "
                "ORDER BY created_at DESC, rowid DESC LIMIT 1",
                (activity_id,),
            ).fetchone()
            if revision:
                record = json.loads(revision["record_json"])
            data["status"] = record["status"]
            date = datetime.now().astimezone().date().isoformat()
            if record["type"] == "Limpeza":
                data["lastCleaning"] = date
            if record["type"] in {"Inspeção", "Verificação", "Observação"}:
                data["lastInspection"] = date
            if record["type"] in {"Calibração", "Calibração diária"}:
                data["lastCalibration"] = date
            connection.execute(
                "UPDATE equipment SET data_json = ?, updated_at = ? WHERE tag = ?",
                (
                    json.dumps(data, ensure_ascii=False),
                    now,
                    activity["equipment_tag"],
                ),
            )
        audit(
            connection,
            user["id"],
            "activity.reviewed",
            activity_id,
            {
                "decision": decision,
                "equipmentTag": activity["equipment_tag"],
                "reviewerName": reviewer_name,
                "authenticated": AUTH_ENABLED,
            },
            self.client_address[0],
        )
        connection.commit()
        activity = connection.execute(
            "SELECT * FROM activities WHERE id = ?", (activity_id,)
        ).fetchone()
        self.send_json(
            HTTPStatus.CREATED,
            {"activity": build_record(connection, activity)},
        )

    def users_route(self, connection: sqlite3.Connection, user: dict):
        if not is_admin(user):
            raise APIError(HTTPStatus.FORBIDDEN, "Apenas administradores podem gerenciar usuários.")
        if self.command == "GET":
            rows = connection.execute(
                "SELECT u.id, u.username, u.name, r.role, u.active, u.created_at "
                "FROM users u JOIN user_roles r ON r.user_id = u.id "
                "WHERE u.id != ? ORDER BY u.username",
                (LOCAL_USER_ID,),
            ).fetchall()
            result = []
            for row in rows:
                assigned = connection.execute(
                    "SELECT equipment_tag FROM equipment_access WHERE user_id = ? "
                    "ORDER BY equipment_tag",
                    (row["id"],),
                ).fetchall()
                result.append(
                    {
                        "id": row["id"],
                        "username": row["username"],
                        "name": row["name"],
                        "role": row["role"],
                        "roleName": ROLE_NAMES[row["role"]],
                        "active": bool(row["active"]),
                        "createdAt": row["created_at"],
                        "equipmentTags": [item["equipment_tag"] for item in assigned],
                    }
                )
            self.send_json(HTTPStatus.OK, {"users": result})
            return
        body = self.read_json()
        access = body.get("equipmentTags", [])
        if not isinstance(access, list) or len(access) > 2000:
            raise APIError(HTTPStatus.BAD_REQUEST, "Lista de equipamentos inválida.")
        created = create_user_in_connection(
            connection,
            body.get("username", ""),
            body.get("name", ""),
            body.get("role"),
            body.get("password", ""),
        )
        self.set_equipment_access(connection, created["id"], access)
        audit(
            connection,
            user["id"],
            "user.created",
            created["username"],
            {"role": created["role"], "equipmentTags": access},
            self.client_address[0],
        )
        connection.commit()
        self.send_json(
            HTTPStatus.CREATED,
            {"user": {**created, "roleName": ROLE_NAMES[created["role"]]}},
        )

    def set_equipment_access(
        self, connection: sqlite3.Connection, user_id: str, tags: list
    ):
        if any(not isinstance(tag, str) or len(tag) > 60 for tag in tags):
            raise APIError(HTTPStatus.BAD_REQUEST, "TAG inválida na lista de permissões.")
        normalized = list(dict.fromkeys(tag.strip().upper() for tag in tags))
        if normalized:
            placeholders = ",".join("?" for _ in normalized)
            found = connection.execute(
                f"SELECT tag FROM equipment WHERE tag IN ({placeholders})",
                normalized,
            ).fetchall()
            if len(found) != len(normalized):
                raise APIError(HTTPStatus.BAD_REQUEST, "Uma ou mais TAGs não existem.")
        connection.execute("DELETE FROM equipment_access WHERE user_id = ?", (user_id,))
        connection.executemany(
            "INSERT INTO equipment_access(user_id, equipment_tag) VALUES (?, ?)",
            [(user_id, tag) for tag in normalized],
        )

    def user_access_route(
        self, connection: sqlite3.Connection, user: dict, path: str
    ):
        if not is_admin(user):
            raise APIError(HTTPStatus.FORBIDDEN, "Apenas administradores podem alterar permissões.")
        parts = path.split("/")
        if len(parts) != 4 or not parts[3]:
            raise APIError(HTTPStatus.NOT_FOUND, "Usuário não encontrado.")
        connection.execute("BEGIN IMMEDIATE")
        target = connection.execute(
            "SELECT u.id, u.username, u.name, u.active, r.role FROM users u "
            "JOIN user_roles r ON r.user_id = u.id "
            "WHERE u.username = ? COLLATE NOCASE",
            (parts[3],),
        ).fetchone()
        if not target:
            raise APIError(HTTPStatus.NOT_FOUND, "Usuário não encontrado.")
        if self.command == "DELETE":
            self.deactivate_user(connection, user, target)
            return

        body = self.read_json()
        allowed_fields = {
            "name", "username", "role", "active", "password", "equipmentTags"
        }
        if not body or set(body) - allowed_fields:
            raise APIError(HTTPStatus.BAD_REQUEST, "Informe somente usuário, nome, perfil, situação, senha ou equipamentos.")
        name = body.get("name", target["name"])
        username = body.get("username", target["username"])
        role = body.get("role", target["role"])
        active = body.get("active", bool(target["active"]))
        password = body.get("password")
        tags = body.get("equipmentTags")
        if not isinstance(role, str) or role not in ROLES:
            raise APIError(HTTPStatus.BAD_REQUEST, "Perfil de acesso inválido.")
        if not isinstance(name, str) or not name.strip() or len(name.strip()) > 120:
            raise APIError(HTTPStatus.BAD_REQUEST, "Informe um nome com até 120 caracteres.")
        if not isinstance(username, str):
            raise APIError(HTTPStatus.BAD_REQUEST, "Nome de usuário inválido.")
        username = username.strip().lower()
        if not re.fullmatch(r"[a-z0-9][a-z0-9._-]{2,39}", username):
            raise APIError(
                HTTPStatus.BAD_REQUEST,
                "Usuário deve ter 3 a 40 caracteres: letras minúsculas, números, ponto, hífen ou sublinhado.",
            )
        if not isinstance(active, bool):
            raise APIError(HTTPStatus.BAD_REQUEST, "Situação da conta inválida.")
        if password is not None and (
            not isinstance(password, str) or not valid_password(password)
        ):
            raise APIError(HTTPStatus.BAD_REQUEST, "A nova senha deve ter entre 8 e 128 caracteres.")
        if tags is not None and (
            not isinstance(tags, list) or len(tags) > 2000
        ):
            raise APIError(HTTPStatus.BAD_REQUEST, "Lista de equipamentos inválida.")
        if target["id"] == user["id"] and (
            role != target["role"] or not active
        ):
            raise APIError(HTTPStatus.CONFLICT, "Não é permitido alterar o próprio perfil ou desativar a própria conta.")
        if target["role"] == "admin" and (role != "admin" or not active):
            active_admins = connection.execute(
                "SELECT COUNT(*) FROM users u JOIN user_roles r ON r.user_id = u.id "
                "WHERE r.role = 'admin' AND u.active = 1"
            ).fetchone()[0]
            if active_admins <= 1:
                raise APIError(HTTPStatus.CONFLICT, "O sistema precisa manter ao menos um Administrador Máximo ativo.")

        changed = {}
        if username != target["username"]:
            conflict = connection.execute(
                "SELECT 1 FROM users WHERE username = ? COLLATE NOCASE AND id != ?",
                (username, target["id"]),
            ).fetchone()
            if conflict:
                raise APIError(HTTPStatus.CONFLICT, "Esse nome de usuário já existe.")
            connection.execute(
                "UPDATE users SET username = ? WHERE id = ?",
                (username, target["id"]),
            )
            changed["username"] = {"from": target["username"], "to": username}
        if name.strip() != target["name"]:
            connection.execute(
                "UPDATE users SET name = ? WHERE id = ?",
                (name.strip(), target["id"]),
            )
            changed["name"] = {"from": target["name"], "to": name.strip()}
        if role != target["role"]:
            database_role = "operator" if role == "viewer" else role
            connection.execute(
                "UPDATE user_roles SET role = ? WHERE user_id = ?",
                (role, target["id"]),
            )
            connection.execute(
                "UPDATE users SET role = ? WHERE id = ?",
                (database_role, target["id"]),
            )
            changed["role"] = {"from": target["role"], "to": role}
        if active != bool(target["active"]):
            connection.execute(
                "UPDATE users SET active = ? WHERE id = ?",
                (int(active), target["id"]),
            )
            changed["active"] = active
            if not active:
                connection.execute(
                    "DELETE FROM sessions WHERE user_id = ?", (target["id"],)
                )
        if tags is not None:
            self.set_equipment_access(connection, target["id"], tags)
            changed["equipmentTags"] = tags
        if password is not None:
            password_hash, salt = hash_password(password)
            connection.execute(
                "UPDATE users SET password_hash = ?, password_salt = ? WHERE id = ?",
                (password_hash, salt, target["id"]),
            )
            connection.execute(
                "DELETE FROM sessions WHERE user_id = ?", (target["id"],)
            )
        if changed:
            audit(
                connection,
                user["id"],
                "user.updated",
                target["username"],
                changed,
                self.client_address[0],
            )
        if password is not None:
            audit(
                connection,
                user["id"],
                "user.password_reset",
                target["username"],
                {},
                self.client_address[0],
            )
        connection.commit()
        self.send_json(HTTPStatus.OK, {"ok": True, "role": role, "active": active})

    def deactivate_user(self, connection: sqlite3.Connection, user: dict, target: sqlite3.Row):
        if target["id"] == user["id"]:
            raise APIError(HTTPStatus.CONFLICT, "Não é permitido desativar a própria conta.")
        if target["active"] and target["role"] == "admin":
            active_admins = connection.execute(
                "SELECT COUNT(*) FROM users u JOIN user_roles r ON r.user_id = u.id "
                "WHERE r.role = 'admin' AND u.active = 1"
            ).fetchone()[0]
            if active_admins <= 1:
                raise APIError(HTTPStatus.CONFLICT, "O sistema precisa manter ao menos um Administrador Máximo ativo.")
        if target["active"]:
            connection.execute(
                "UPDATE users SET active = 0 WHERE id = ?", (target["id"],)
            )
            connection.execute(
                "DELETE FROM sessions WHERE user_id = ?", (target["id"],)
            )
            audit(
                connection,
                user["id"],
                "user.deactivated",
                target["username"],
                {"active": False},
                self.client_address[0],
            )
            connection.commit()
        self.send_json(HTTPStatus.OK, {"ok": True, "active": False})

    def do_GET(self):
        request_path = urlsplit(self.path).path
        if request_path.startswith("/api/"):
            self.handle_api()
        elif request_path == "/":
            self.path = "/index.html"
            super().do_GET()
        elif request_path in {"/index.html", "/styles.css", "/app.js"}:
            super().do_GET()
        else:
            self.send_error(HTTPStatus.NOT_FOUND)

    def do_POST(self):
        self.handle_api()

    def do_PUT(self):
        self.handle_api()

    def do_PATCH(self):
        self.handle_api()

    def do_DELETE(self):
        self.handle_api()

    def end_headers(self):
        self.send_header("X-Frame-Options", "DENY")
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("Referrer-Policy", "same-origin")
        self.send_header("Permissions-Policy", "camera=(), microphone=(), geolocation=()")
        super().end_headers()

def create_admin_interactive(db_path: Path = DB_PATH) -> None:
    initialize_database(db_path)
    with connect_db(db_path) as connection:
        if connection.execute("SELECT 1 FROM users LIMIT 1").fetchone():
            raise SystemExit("Já existe usuário. Crie contas adicionais após entrar como administrador.")
    username = input("Usuário administrador (3-40 caracteres): ").strip()
    name = input("Nome completo: ").strip()
    password = getpass.getpass("Senha (mínimo 8 caracteres): ")
    confirmation = getpass.getpass("Confirme a senha: ")
    if not hmac.compare_digest(password, confirmation):
        raise SystemExit("As senhas não conferem.")
    user = create_user(username, name, "admin", password, db_path)
    with connect_db(db_path) as connection:
        audit(connection, user["id"], "user.initial_admin_created", user["username"], {}, "local-cli")
        connection.commit()
    print(f"Administrador {user['username']} cadastrado.")


def backup_database(
    destination: Path | None = None, db_path: Path = DB_PATH
) -> Path:
    if not db_path.is_file():
        raise SystemExit(f"Banco não encontrado: {db_path}")
    if destination is None:
        stamp = datetime.now().strftime("%Y%m%d-%H%M%S")
        destination = db_path.parent / "backups" / f"labtrack-{stamp}.sqlite3"
    destination = Path(destination)
    if destination.resolve() == db_path.resolve():
        raise SystemExit("O destino do backup não pode ser o próprio banco.")
    destination.parent.mkdir(parents=True, exist_ok=True)
    source = sqlite3.connect(db_path, timeout=15)
    target = sqlite3.connect(destination)
    try:
        source.backup(target)
    finally:
        target.close()
        source.close()
    if os.name != "nt":
        destination.chmod(0o600)
    return destination


def serve(host: str = "127.0.0.1", port: int = 8000, db_path: Path = DB_PATH):
    if not AUTH_ENABLED:
        try:
            addresses = {
                ipaddress.ip_address(item[4][0].split("%", 1)[0])
                for item in socket.getaddrinfo(host, port, type=socket.SOCK_STREAM)
            }
        except (OSError, ValueError) as error:
            raise SystemExit("O modo sem autenticação exige um endereço local válido.") from error
        if not addresses or any(not address.is_loopback for address in addresses):
            raise SystemExit(
                "O modo sem autenticação só pode escutar em um endereço loopback "
                "(127.0.0.1 ou ::1)."
            )
    initialize_database(db_path)
    server = LabTrackServer((host, port), Handler, db_path)
    print(f"LabTrack disponível em http://{host}:{port}")
    print(f"Banco SQLite: {db_path}")
    print("Use Ctrl+C para encerrar. Em produção, use HTTPS e um servidor WSGI/ASGI gerenciado.")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nEncerrando LabTrack...")
    finally:
        server.server_close()


def main():
    if len(sys.argv) > 1 and sys.argv[1] == "create-admin":
        create_admin_interactive()
    elif len(sys.argv) > 1 and sys.argv[1] == "backup":
        destination = Path(sys.argv[2]) if len(sys.argv) > 2 else None
        print(f"Backup criado: {backup_database(destination)}")
    else:
        host = os.environ.get("LABTRACK_HOST", "127.0.0.1")
        port = int(os.environ.get("LABTRACK_PORT", "8000"))
        serve(host, port)


if __name__ == "__main__":
    main()
