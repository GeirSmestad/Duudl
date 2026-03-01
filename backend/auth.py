from __future__ import annotations

from functools import wraps
from typing import Any, Callable, TypeVar

from flask import redirect, request, session, url_for

from backend.db import User, get_user

T = TypeVar("T")


def is_authed() -> bool:
    return bool(session.get("authed"))


def get_selected_user() -> User | None:
    user_id = session.get("user_id")
    if user_id is None:
        return None
    try:
        return get_user(int(user_id))
    except Exception:
        return None


def _request_target_url() -> str:
    return request.full_path if request.query_string else request.path


def _is_safe_next_url(next_url: str) -> bool:
    # Require app-local paths and avoid internal/auth endpoints as login return targets.
    blocked_prefixes = ("/login", "/logout", "/select-user", "/api/")
    return next_url.startswith("/") and not next_url.startswith("//") and not next_url.startswith(blocked_prefixes)


def set_next_url_from_request() -> None:
    # Only persist navigational targets. POST/PUT/etc would become GET after redirect.
    if request.method not in ("GET", "HEAD"):
        return

    next_url = _request_target_url()
    if _is_safe_next_url(next_url):
        session["next_url"] = next_url


def pop_next_url(default_endpoint: str = "overview") -> str:
    next_url = session.pop("next_url", None)
    if isinstance(next_url, str) and _is_safe_next_url(next_url):
        return next_url
    return url_for(default_endpoint)


def require_login(view: Callable[..., T]) -> Callable[..., T]:
    @wraps(view)
    def wrapper(*args: Any, **kwargs: Any) -> T:
        if not is_authed():
            set_next_url_from_request()
            return redirect(url_for("login"))  # type: ignore[return-value]
        return view(*args, **kwargs)

    return wrapper


def require_selected_user(view: Callable[..., T]) -> Callable[..., T]:
    @wraps(view)
    def wrapper(*args: Any, **kwargs: Any) -> T:
        if not is_authed():
            set_next_url_from_request()
            return redirect(url_for("login"))  # type: ignore[return-value]

        if get_selected_user() is None:
            set_next_url_from_request()
            return redirect(url_for("select_user"))  # type: ignore[return-value]

        return view(*args, **kwargs)

    return wrapper
