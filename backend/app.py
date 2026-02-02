from __future__ import annotations

import json
import os
import secrets
from typing import Any

from flask import Flask, Response, jsonify, redirect, render_template, request, session, url_for

from backend.auth import get_selected_user, is_authed, pop_next_url, require_login, require_selected_user
from backend.db import (
    close_db,
    create_duudl,
    delete_duudl,
    ensure_schema,
    fetch_duudl_state_json,
    get_duudl_by_token,
    get_user,
    list_duudls,
    list_users,
    update_duudl,
    upsert_response,
)


def _template_context() -> dict[str, Any]:
    selected_user = get_selected_user()
    return {
        "is_authed": is_authed(),
        "selected_user": selected_user,
        "flash_error": session.pop("flash_error", None),
    }


def _set_form_state(key: str, state: dict[str, Any]) -> None:
    session[key] = state


def _pop_form_state(key: str) -> dict[str, Any]:
    state = session.pop(key, None)
    return state if isinstance(state, dict) else {}


def create_app() -> Flask:
    app = Flask(__name__)
    app.config["SECRET_KEY"] = _load_secret_key()
    app.config["DATABASE_PATH"] = os.environ.get("DUUDL_DB_PATH", "data/duudl.db")

    @app.template_filter("no_month_date")
    def no_month_date(value: str) -> str:
        """
        Formats an ISO date/datetime string to 'DD. monthname YYYY' (Norwegian month name, lowercase).
        Example: '2026-02-03T12:34:56Z' -> '03. februar 2026'
        """
        s = (value or "").strip()
        iso = s[:10]  # YYYY-MM-DD
        try:
            year = int(iso[0:4])
            month = int(iso[5:7])
            day = int(iso[8:10])
        except Exception:
            return iso or s

        months = [
            "januar",
            "februar",
            "mars",
            "april",
            "mai",
            "juni",
            "juli",
            "august",
            "september",
            "oktober",
            "november",
            "desember",
        ]
        if 1 <= month <= 12:
            month_name = months[month - 1]
            return f"{day}. {month_name} {year}"
        return iso

    @app.before_request
    def _ensure_db_schema():
        ensure_schema()

    app.teardown_appcontext(close_db)

    @app.get("/healthz")
    def healthz():
        return {"ok": True}

    @app.get("/login")
    def login():
        if is_authed():
            return redirect(url_for("select_user"))
        return render_template("login.html", title="Logg inn", **_template_context())

    @app.post("/login")
    def login_post():
        password = (request.form.get("password") or "").strip()
        if password.lower() != "wattifnatt":
            session["flash_error"] = "Feil passord."
            return redirect(url_for("login"))

        session["authed"] = True
        return redirect(url_for("select_user"))

    @app.post("/logout")
    def logout():
        session.clear()
        return redirect(url_for("login"))

    @app.get("/select-user")
    @require_login
    def select_user():
        users = list_users()
        return render_template(
            "select_user.html",
            title="Velg bruker",
            users=users,
            **_template_context(),
        )

    @app.post("/select-user")
    @require_login
    def select_user_post():
        user_id_raw = request.form.get("user_id")
        try:
            user_id = int(user_id_raw or "")
        except Exception:
            session["flash_error"] = "Ugyldig bruker."
            return redirect(url_for("select_user"))

        user = get_user(user_id)
        if user is None:
            session["flash_error"] = "Ugyldig bruker."
            return redirect(url_for("select_user"))

        session["user_id"] = user.id
        return redirect(pop_next_url(default_endpoint="overview"))

    @app.get("/")
    @require_selected_user
    def overview():
        duudls = list_duudls()
        return render_template(
            "overview.html",
            title="Oversikt",
            duudls=duudls,
            **_template_context(),
        )

    @app.get("/duudl/new")
    @require_selected_user
    def duudl_new():
        form_state = _pop_form_state("duudl_new_form_state")
        return render_template(
            "duudl_new.html",
            title="Ny Duudl",
            form_title=form_state.get("title", ""),
            form_description=form_state.get("description", ""),
            form_selected_days_json=form_state.get("selected_days_json", "[]"),
            **_template_context(),
        )

    @app.post("/duudl/new")
    @require_selected_user
    def duudl_new_post():
        selected_user = get_selected_user()
        assert selected_user is not None

        title_raw = request.form.get("title") or ""
        description_raw = request.form.get("description") or ""
        title = title_raw.strip()
        description = description_raw.strip()
        days_json = request.form.get("selected_days_json") or "[]"
        try:
            days = json.loads(days_json)
        except Exception:
            days = []

        if not title:
            _set_form_state(
                "duudl_new_form_state",
                {"title": title_raw, "description": description_raw, "selected_days_json": days_json},
            )
            session["flash_error"] = "Skriv inn en tittel."
            return redirect(url_for("duudl_new"))

        if not isinstance(days, list) or not days:
            _set_form_state(
                "duudl_new_form_state",
                {"title": title_raw, "description": description_raw, "selected_days_json": days_json},
            )
            session["flash_error"] = "Velg minst én dato."
            return redirect(url_for("duudl_new"))

        token = secrets.token_urlsafe(8)
        create_duudl(
            token=token,
            title=title,
            description=description,
            created_by_user_id=selected_user.id,
            days=[str(d) for d in days],
        )
        return redirect(url_for("show_duudl", token=token))

    @app.get("/d/<token>")
    @require_selected_user
    def show_duudl(token: str):
        duudl = get_duudl_by_token(token)
        if duudl is None:
            return Response("Not found", status=404)

        selected_user = get_selected_user()
        assert selected_user is not None

        return render_template(
            "show_duudl.html",
            title=duudl.title,
            duudl=duudl,
            selected_user_id=selected_user.id,
            **_template_context(),
        )

    @app.get("/d/<token>/edit")
    @require_selected_user
    def edit_duudl_page(token: str):
        duudl = get_duudl_by_token(token)
        if duudl is None:
            return Response("Not found", status=404)

        return render_template(
            "edit_duudl.html",
            title=f"Rediger: {duudl.title}",
            duudl=duudl,
            **_template_context(),
        )

    @app.post("/d/<token>/edit")
    @require_selected_user
    def edit_duudl_post(token: str):
        duudl = get_duudl_by_token(token)
        if duudl is None:
            return Response("Not found", status=404)

        title = (request.form.get("title") or "").strip()
        description = (request.form.get("description") or "").strip()
        days_json = request.form.get("selected_days_json") or "[]"
        try:
            days = json.loads(days_json)
        except Exception:
            days = []

        if not title:
            session["flash_error"] = "Skriv inn en tittel."
            return redirect(url_for("edit_duudl_page", token=token))

        if not isinstance(days, list) or not days:
            session["flash_error"] = "Velg minst én dato."
            return redirect(url_for("edit_duudl_page", token=token))

        update_duudl(duudl_id=duudl.id, title=title, description=description, new_days=[str(d) for d in days])
        return redirect(url_for("show_duudl", token=token))

    @app.post("/d/<token>/delete")
    @require_selected_user
    def delete_duudl_post(token: str):
        duudl = get_duudl_by_token(token)
        if duudl is None:
            return Response("Not found", status=404)

        delete_duudl(duudl_id=duudl.id)
        return redirect(url_for("overview"))

    @app.get("/api/duudl/<token>")
    @require_selected_user
    def api_duudl(token: str):
        duudl = get_duudl_by_token(token)
        if duudl is None:
            return Response("Not found", status=404)
        return jsonify(fetch_duudl_state_json(duudl.id))

    @app.post("/api/duudl/<token>/response")
    @require_selected_user
    def api_response(token: str):
        duudl = get_duudl_by_token(token)
        if duudl is None:
            return Response("Not found", status=404)

        selected_user = get_selected_user()
        assert selected_user is not None

        payload = request.get_json(silent=True) or {}
        day = str(payload.get("day") or "")
        value = payload.get("value", None)
        if value is not None:
            value = str(value)
            if value not in ("yes", "no", "inconvenient"):
                return Response("Bad value", status=400)

        if not day:
            return Response("Bad day", status=400)

        upsert_response(duudl_id=duudl.id, user_id=selected_user.id, day=day, value=value)
        return jsonify({"ok": True})

    @app.post("/api/duudl/<token>/admin-response")
    @require_selected_user
    def api_admin_response(token: str):
        """
        Used from the Edit Duudl page to edit the full grid for all users
        (as specified in the attached plan).
        """
        duudl = get_duudl_by_token(token)
        if duudl is None:
            return Response("Not found", status=404)

        payload = request.get_json(silent=True) or {}
        try:
            user_id = int(payload.get("user_id"))
        except Exception:
            return Response("Bad user_id", status=400)

        day = str(payload.get("day") or "")
        value = payload.get("value", None)
        if value is not None:
            value = str(value)
            if value not in ("yes", "no", "inconvenient"):
                return Response("Bad value", status=400)

        if not day:
            return Response("Bad day", status=400)

        if get_user(user_id) is None:
            return Response("Unknown user", status=400)

        upsert_response(duudl_id=duudl.id, user_id=user_id, day=day, value=value)
        return jsonify({"ok": True})

    return app


def _load_secret_key() -> str:
    explicit = os.environ.get("DUUDL_SECRET_KEY")
    if explicit:
        return explicit

    key_file = os.environ.get("DUUDL_SECRET_KEY_FILE")
    if key_file:
        try:
            with open(key_file, "r", encoding="utf-8") as f:
                return f.read().strip()
        except Exception:
            pass

    return "dev"


def main() -> None:
    app = create_app()
    app.run(host="127.0.0.1", port=5001, debug=True)


if __name__ == "__main__":
    main()

