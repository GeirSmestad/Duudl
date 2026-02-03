from __future__ import annotations

import os
import sqlite3
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any

from flask import current_app, g


@dataclass(frozen=True)
class User:
    id: int
    slug: str
    display_name: str


@dataclass(frozen=True)
class DuudlListRow:
    token: str
    title: str
    created_at: str
    created_by_display_name: str
    response_user_count: int


@dataclass(frozen=True)
class Duudl:
    id: int
    token: str
    title: str
    description: str
    created_at: str
    created_by_user_id: int


def utc_now_iso() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def _get_db_path() -> str:
    return current_app.config["DATABASE_PATH"]


def get_db() -> sqlite3.Connection:
    if "db" not in g:
        db_path = _get_db_path()
        os.makedirs(os.path.dirname(db_path), exist_ok=True)
        conn = sqlite3.connect(db_path)
        conn.row_factory = sqlite3.Row
        conn.execute("PRAGMA foreign_keys = ON")
        g.db = conn
    return g.db


def close_db(_exc: BaseException | None = None) -> None:
    conn: sqlite3.Connection | None = g.pop("db", None)
    if conn is not None:
        conn.close()


def ensure_schema() -> None:
    db = get_db()

    db.executescript(
        """
        CREATE TABLE IF NOT EXISTS users (
          id INTEGER PRIMARY KEY,
          slug TEXT NOT NULL UNIQUE,
          display_name TEXT NOT NULL UNIQUE
        );

        CREATE TABLE IF NOT EXISTS duudls (
          id INTEGER PRIMARY KEY,
          token TEXT NOT NULL UNIQUE,
          title TEXT NOT NULL,
          description TEXT NOT NULL DEFAULT '',
          created_by_user_id INTEGER NOT NULL,
          created_at TEXT NOT NULL,
          FOREIGN KEY(created_by_user_id) REFERENCES users(id)
        );

        CREATE TABLE IF NOT EXISTS duudl_dates (
          id INTEGER PRIMARY KEY,
          duudl_id INTEGER NOT NULL,
          day TEXT NOT NULL,
          UNIQUE(duudl_id, day),
          FOREIGN KEY(duudl_id) REFERENCES duudls(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS responses (
          id INTEGER PRIMARY KEY,
          duudl_id INTEGER NOT NULL,
          user_id INTEGER NOT NULL,
          day TEXT NOT NULL,
          value TEXT,
          comment TEXT NOT NULL DEFAULT '',
          UNIQUE(duudl_id, user_id, day),
          FOREIGN KEY(duudl_id) REFERENCES duudls(id) ON DELETE CASCADE,
          FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
        );

        CREATE INDEX IF NOT EXISTS idx_responses_duudl_id ON responses(duudl_id);
        CREATE INDEX IF NOT EXISTS idx_responses_duudl_user_id ON responses(user_id);
        CREATE INDEX IF NOT EXISTS idx_duudl_dates_duudl_id ON duudl_dates(duudl_id);
        """
    )

    _ensure_duudls_has_description(db)
    _ensure_responses_has_comment(db)
    seed_users(db)
    db.commit()


def _ensure_duudls_has_description(db: sqlite3.Connection) -> None:
    cols = [r["name"] for r in db.execute("PRAGMA table_info(duudls)").fetchall()]
    if "description" in cols:
        return
    db.execute("ALTER TABLE duudls ADD COLUMN description TEXT NOT NULL DEFAULT ''")


def _ensure_responses_has_comment(db: sqlite3.Connection) -> None:
    cols = [r["name"] for r in db.execute("PRAGMA table_info(responses)").fetchall()]
    if "comment" in cols:
        return
    db.execute("ALTER TABLE responses ADD COLUMN comment TEXT NOT NULL DEFAULT ''")


def seed_users(db: sqlite3.Connection) -> None:
    users = [
        ("huez-helge", "Huez-Helge"),
        ("andreas-aubisque", "Andreas Aubisque"),
        ("deux-alpes-daniel", "Deux Alpes-Daniel"),
        ("croix-de-fer-christer", "Croix-de-fer-Christer"),
        ("galibier-geir", "Galibier-Geir"),
    ]
    for slug, display_name in users:
        db.execute(
            "INSERT OR IGNORE INTO users (slug, display_name) VALUES (?, ?)",
            (slug, display_name),
        )


def list_users() -> list[User]:
    rows = get_db().execute("SELECT id, slug, display_name FROM users ORDER BY id").fetchall()
    return [User(id=r["id"], slug=r["slug"], display_name=r["display_name"]) for r in rows]


def get_user(user_id: int) -> User | None:
    row = get_db().execute(
        "SELECT id, slug, display_name FROM users WHERE id = ?",
        (user_id,),
    ).fetchone()
    if row is None:
        return None
    return User(id=row["id"], slug=row["slug"], display_name=row["display_name"])


def list_duudls() -> list[DuudlListRow]:
    rows = get_db().execute(
        """
        SELECT
          d.token,
          d.title,
          d.created_at,
          u.display_name AS created_by_display_name,
          COALESCE(COUNT(DISTINCT r.user_id), 0) AS response_user_count
        FROM duudls d
        JOIN users u ON u.id = d.created_by_user_id
        LEFT JOIN responses r ON r.duudl_id = d.id AND (r.value IS NOT NULL OR r.comment != '')
        GROUP BY d.id
        ORDER BY d.created_at DESC
        """
    ).fetchall()
    return [
        DuudlListRow(
            token=r["token"],
            title=r["title"],
            created_at=r["created_at"],
            created_by_display_name=r["created_by_display_name"],
            response_user_count=r["response_user_count"],
        )
        for r in rows
    ]


def create_duudl(*, token: str, title: str, description: str, created_by_user_id: int, days: list[str]) -> None:
    db = get_db()
    created_at = utc_now_iso()
    cur = db.execute(
        "INSERT INTO duudls (token, title, description, created_by_user_id, created_at) VALUES (?, ?, ?, ?, ?)",
        (token, title, description, created_by_user_id, created_at),
    )
    duudl_id = int(cur.lastrowid)

    unique_days = sorted(set(days))
    for day in unique_days:
        db.execute("INSERT INTO duudl_dates (duudl_id, day) VALUES (?, ?)", (duudl_id, day))

    # Default availability: the creator is "yes" for all days when a Duudl is created.
    for day in unique_days:
        db.execute(
            "INSERT OR IGNORE INTO responses (duudl_id, user_id, day, value) VALUES (?, ?, ?, 'yes')",
            (duudl_id, created_by_user_id, day),
        )

    db.commit()


def get_duudl_by_token(token: str) -> Duudl | None:
    row = get_db().execute(
        "SELECT id, token, title, description, created_at, created_by_user_id FROM duudls WHERE token = ?",
        (token,),
    ).fetchone()
    if row is None:
        return None
    return Duudl(
        id=row["id"],
        token=row["token"],
        title=row["title"],
        description=row["description"],
        created_at=row["created_at"],
        created_by_user_id=row["created_by_user_id"],
    )


def list_duudl_days(duudl_id: int) -> list[str]:
    rows = get_db().execute(
        "SELECT day FROM duudl_dates WHERE duudl_id = ? ORDER BY day",
        (duudl_id,),
    ).fetchall()
    return [r["day"] for r in rows]


def get_responses_maps(duudl_id: int) -> tuple[dict[tuple[int, str], str | None], dict[tuple[int, str], str]]:
    rows = get_db().execute(
        "SELECT user_id, day, value, comment FROM responses WHERE duudl_id = ?",
        (duudl_id,),
    ).fetchall()
    values: dict[tuple[int, str], str | None] = {}
    comments: dict[tuple[int, str], str] = {}
    for r in rows:
        key = (int(r["user_id"]), str(r["day"]))
        values[key] = r["value"]
        comments[key] = str(r["comment"] or "")
    return values, comments


def upsert_response(*, duudl_id: int, user_id: int, day: str, value: str | None, comment: str | None) -> None:
    db = get_db()
    if comment is None:
        # Value-only update; preserve existing comment.
        db.execute(
            """
            INSERT INTO responses (duudl_id, user_id, day, value, comment)
            VALUES (?, ?, ?, ?, '')
            ON CONFLICT(duudl_id, user_id, day) DO UPDATE SET
              value = excluded.value
            """,
            (duudl_id, user_id, day, value),
        )
    else:
        comment_to_store = str(comment).strip()
        db.execute(
            """
            INSERT INTO responses (duudl_id, user_id, day, value, comment)
            VALUES (?, ?, ?, ?, ?)
            ON CONFLICT(duudl_id, user_id, day) DO UPDATE SET
              value = excluded.value,
              comment = excluded.comment
            """,
            (duudl_id, user_id, day, value, comment_to_store),
        )
    db.commit()


def update_duudl(*, duudl_id: int, title: str, description: str, new_days: list[str]) -> list[str]:
    """
    Updates duudl title and dates.
    Returns a list of removed day strings (YYYY-MM-DD).
    """
    db = get_db()

    existing_days = set(list_duudl_days(duudl_id))
    desired_days = set(new_days)
    removed = sorted(existing_days - desired_days)
    added = sorted(desired_days - existing_days)

    db.execute("UPDATE duudls SET title = ?, description = ? WHERE id = ?", (title, description, duudl_id))

    for day in added:
        db.execute("INSERT OR IGNORE INTO duudl_dates (duudl_id, day) VALUES (?, ?)", (duudl_id, day))

    # Default availability for newly added dates: original creator is "yes".
    if added:
        row = db.execute("SELECT created_by_user_id FROM duudls WHERE id = ?", (duudl_id,)).fetchone()
        if row is not None:
            creator_user_id = int(row["created_by_user_id"])
            for day in added:
                db.execute(
                    "INSERT OR IGNORE INTO responses (duudl_id, user_id, day, value) VALUES (?, ?, ?, 'yes')",
                    (duudl_id, creator_user_id, day),
                )

    for day in removed:
        db.execute("DELETE FROM duudl_dates WHERE duudl_id = ? AND day = ?", (duudl_id, day))
        db.execute("DELETE FROM responses WHERE duudl_id = ? AND day = ?", (duudl_id, day))

    db.commit()
    return removed


def delete_duudl(*, duudl_id: int) -> None:
    db = get_db()
    db.execute("DELETE FROM duudls WHERE id = ?", (duudl_id,))
    db.commit()


def fetch_duudl_state_json(duudl_id: int) -> dict[str, Any]:
    users = list_users()
    days = list_duudl_days(duudl_id)
    values, comments = get_responses_maps(duudl_id)
    return {
        "users": [{"id": u.id, "display_name": u.display_name} for u in users],
        "days": days,
        "responses": {f"{user_id}:{day}": value for (user_id, day), value in values.items()},
        "comments": {f"{user_id}:{day}": comment for (user_id, day), comment in comments.items() if comment},
    }

