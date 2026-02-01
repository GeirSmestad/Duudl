default:
    @echo "Usage:"
    @echo "  just install   # install Python deps"
    @echo "  just run       # run dev server on http://127.0.0.1:5001/"
    @echo ""
    @echo "Recipes:"
    @just --list

install:
    python3 -m pip install -r requirements.txt

run:
    python3 -m backend.app

