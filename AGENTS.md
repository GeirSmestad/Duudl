# AGENTS.md - Cursor Agent Instructions

This file provides context and guidelines for AI agents working on this codebase.

## Project Overview

This is a small web application for helping friends with busy calendars to schedule their meet-ups.

## Agent behavior requirements

- Use English for all code and communication with me, the Cursor user. The user interface for this app, however, is in Norwegian.
- For database changes, don't *run* any migration scripts or state-changing validation code yourself. Changes that will modify the database will be performed only by me. Describe what's needed to me, if necessary.
- Server can be reached with `ssh bergenomap`, but don't run server commands yourself (prompt me if necessary)
- Server is shared with other apps, so while you're free to edit `bootstrap.sh` as required, take care not to damage the environment for other apps

## Coding philosophy

- Pragmatism over purity. Prefer readable, maintainable solutions. Principles are a tool for *managing* complexity, not growing it.
- Readability first. Use explicit, descriptive names. Aim for self-explanatory code. Avoid excessive cleverness.
- No unit tests for now. This may change later, so modular code structure is encouraged.
- Validation: Perform whatever lightweight validation is suitable after making changes

## Tech Stack

- **Frontend**: Vanilla JavaScript (as ES modules), HTML, CSS
- **Backend**: Python (Flask-based for both REST queries and serving HTML)
- **Database**: SQLite (default `data/duudl.db`)
- **Build system**: Just
- **Runtime/hosting**: AWS Lightsail VPS (shared with other apps). Nginx as web server. `bootstrap.sh` runs on deploy and sets up server infrastructure.

## Where to find more info

- Check .cursor/rules/ for language-specific coding conventions

## How to run the app locally

The development environment may be either OS X & Terminal or Windows & Powershell; this might be relevant for environment-impacting questions.

```bash
# Backend (from repo root)
python3 -m pip install -r requirements.txt
# Run the app
python3 -m backend.app

# Access the app at http://127.0.0.1:5001/
```

## Database

SQLite database under `data/`. Migrations are numbered SQL scripts in folder `db_migrations`.

## Miscellaneous Notes

- Code, documentation and markup is English, user-facing text is Norwegian