# 🔧 MyEarth Working Setup Reference

*Last updated: August 8, 2024*

## 🖥️ **LOCAL MACHINE (macOS)**
- **OS**: macOS 12.6 (Darwin 21.6.0) - ARM64 (Apple Silicon)
- **User**: `gabriela`
- **Python**: 3.9.6
- **Node.js**: v20.18.0
- **Working Directory**: `/Users/gabriela/Library/Mobile Documents/com~apple~CloudDocs/repo/StemStack/myearth/MyEarth`
- **Virtual Environment**: `venv/` (activated)
- **Local Server**: Running on `http://localhost:5001`

## 🔑 **GITHUB CONFIGURATION**
- **Repository**: `git@github.com:StemStack/MyEarth.git`
- **User**: `StemStack` (`jeancharles.schaegis@gmail.com`)
- **Current Branch**: `main`
- **Latest Version**: v0.4.2 (commit `ae58ad7`)
- **Other Branches**: `Dev`, `clean-up`

## 🖥️ **HP MINI SERVER**
- **SSH Access**: `jc@100.69.50.87` (Tailscale IP preferred)
- **Tailscale IP**: `100.69.50.87` (secured connection)
- **Public Domain**: `https://myearth.app`
- **Service**: `myearth.service` (systemd)
- **Working Directory**: `/home/jc/MyEarth`
- **Database**: PostgreSQL (`myearth` database, `myearth_user`)

## 🔧 **APPLICATION STACK**
- **Framework**: FastAPI + Uvicorn
- **Database**: PostgreSQL with psycopg2
- **Static Files**: CesiumJS served via `/static`
- **Authentication**: OAuth (Google, GitHub, LinkedIn)
- **Key Dependencies**:
  - FastAPI 0.104.1
  - Uvicorn 0.24.0
  - SQLAlchemy 2.0.23
  - psycopg2-binary 2.9.9
  - GeoPandas 0.14.1

## 🚀 **DEPLOYMENT WORKFLOW**

### Local Development
```bash
# Start development server
source venv/bin/activate && python main.py

# Start background server
nohup python main.py > server.log 2>&1 &

# Check server status
curl http://localhost:5001/api/ping
```

### Production Deployment
```bash
# 1. Push to GitHub (triggers GitHub Actions)
git push origin main

# 2. SSH to server and update
ssh jc@100.69.50.87
cd /home/jc/MyEarth
git pull
sudo systemctl restart myearth
```

## 🔧 **TROUBLESHOOTING COMMANDS**

### Emergency Commands
```bash
# Emergency restart
./fix-deployment.sh

# Check server status
sudo systemctl status myearth

# View logs
sudo journalctl -u myearth -f

# Manual start
source venv/bin/activate && python3 main.py

# Nginx fix
sudo bash /home/jc/MyEarth/fix-nginx-manual.sh
```

### Local Development Issues
```bash
# Kill existing server
pkill -f "python main.py"

# Check port usage
lsof -i :5001

# View server logs
tail -f server.log

# Test database connection
python -c "import psycopg2; print('PostgreSQL OK')"
```

## 🔐 **SECURITY & ACCESS**
- **SSH Keys**: 
  - Main: `~/.ssh/id_ed25519`
  - MyEarth specific: `~/.ssh/id_ed25519_myearth`
- **Database Password**: Stored in `.env` (not in Git)
- **SSL**: Certbot-managed certificates
- **Preferred Connection**: Tailscale IP over public IP

## 📁 **KEY FILES & DIRECTORIES**
- **Main App**: `main.py`
- **Requirements**: `requirements.txt`
- **Environment**: `.env` (local secrets)
- **Service Config**: `myearth.service`
- **Nginx Config**: `nginx.conf`
- **Deployment Scripts**: `fix-deployment.sh`, `fix-nginx-manual.sh`
- **Documentation**: `DEPLOYMENT.md`, `DEPLOYMENT_TROUBLESHOOTING.md`

## 🌐 **NETWORK PORTS**
- **Local Development**: 5001
- **Production**: 80/443 (via Nginx)
- **Database**: 5432 (PostgreSQL)

## ⚠️ **IMPORTANT NOTES**
- **Version Management**: Every push to main creates a new revision
- **Database**: Local development runs without DB (PostgreSQL not available)
- **Logs**: Server logs written to `server.log` (local) or systemd journal (server)
- **Environment**: `.env` file is gitignored for security
- **Tailscale**: Preferred for secure server access

## 🔍 **QUICK COMMANDS REFERENCE**

### Local Development
```bash
# Start server
source venv/bin/activate && python main.py

# Background server
nohup python main.py > server.log 2>&1 &

# Stop server
pkill -f "python main.py"

# Check if running
curl http://localhost:5001/api/ping
```

### Git Operations
```bash
# Check status
git status

# Pull latest
git pull origin main

# Push changes
git add . && git commit -m "message" && git push origin main
```

### Server Operations
```bash
# SSH to server
ssh jc@100.69.50.87

# Check service status
sudo systemctl status myearth

# Restart service
sudo systemctl restart myearth

# View logs
sudo journalctl -u myearth -f
```

### Database Operations
```bash
# Connect to PostgreSQL
sudo -u postgres psql

# Change password
ALTER USER myearth_user WITH PASSWORD 'new_password';

# Exit
\q
```

---

*This file should be updated whenever the setup changes. Keep it in the project root for easy access.*
