# Duudl

This is an off-brand clone of a popular meetup scheduling service.

## TODO

- [ ] Replace full names with initials on narrow screens (or on mobile in general)
- [ ] Narrower margins for the most narrow screen sizes

## How to run the app

```bash
# Backend (from repo root)
python3 -m pip install -r requirements.txt
# Run the app
python3 -m backend.app

# Access the app at http://127.0.0.1:5001/
```

You can also use `just run`.

## How to deploy

```bash
# Backend (from repo root)
`just deploy`
```

This copies all files to the server as a tarball, and runs `bootstrap.sh` to idempotently set up the server environment.