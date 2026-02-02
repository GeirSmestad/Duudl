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

# Deploy to the server (shared machine). This copies code but preserves server-side data/ and venv/.
# You can override variables:
#   just deploy
#   just deploy SSH_HOST=bergenomap REMOTE_DIR=/srv/duudl
SSH_HOST := "bergenomap"
REMOTE_DIR := "/srv/duudl"

deploy:
    rm -f ./.duudl-deploy.tgz
    tar -czf ./.duudl-deploy.tgz \
      --exclude ".git" \
      --exclude "__pycache__" \
      --exclude "*.pyc" \
      --exclude "data" \
      --exclude ".venv" \
      .
    ssh {{SSH_HOST}} "mkdir -p {{REMOTE_DIR}}"
    scp ./.duudl-deploy.tgz {{SSH_HOST}}:/tmp/duudl-deploy.tgz
    ssh {{SSH_HOST}} "tar -xzf /tmp/duudl-deploy.tgz -C {{REMOTE_DIR}} && rm -f /tmp/duudl-deploy.tgz && cd {{REMOTE_DIR}} && sudo bash ./bootstrap.sh"
    rm -f ./.duudl-deploy.tgz
