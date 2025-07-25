# Deployment Guide – MyEarth

## Project Overview
- Framework: FastAPI + Uvicorn
- Static files: CesiumJS served via /static
- Database: PostgreSQL (myearth / myearth_user)
- Domain: https://myearth.app (Nginx + Certbot SSL)

---

## Environment Setup
- Virtual environment: ~/MyEarth/venv
- Secrets stored in `.env` (ignored by Git)

Example `.env`:
DB_NAME=myearth
DB_USER=myearth_user
DB_PASSWORD=your_password
DB_HOST=localhost
DB_PORT=5432

---

## Deployment Workflow

### Update code from GitHub
cd ~/MyEarth
git pull
sudo systemctl restart myearth

### Service Management
sudo systemctl status myearth      # Check status
sudo systemctl restart myearth     # Restart after changes
sudo journalctl -u myearth -f      # Live logs

### Nginx / SSL
Config: /etc/nginx/sites-available/myearth
Certbot renew:
sudo certbot renew --dry-run

---

## Database Management
Change password:
sudo -u postgres psql
ALTER USER myearth_user WITH PASSWORD 'new_password';
\q

---

## Add API Keys (future)
1. Add key to `.env`:
API_KEY_SERVICE=xxxx

2. Load in code:
os.getenv("API_KEY_SERVICE")

---

## Test Endpoints
- Health: https://myearth.app/api/ping
- DB check: https://myearth.app/api/test-db
- Example external data: https://myearth.app/api/tree-cover-loss

---

## Notes
- Service auto-starts on server reboot.
- `.env` is excluded via `.gitignore` (never push to GitHub).
- Keep this file updated if new steps or services are added.
