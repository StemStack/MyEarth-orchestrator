# MyEarth.app Deployment Troubleshooting Guide

## 🚨 Quick Fix Commands

### **Emergency Restart**
```bash
# SSH into server
ssh jc@100.69.50.87

# Run deployment fix
cd /home/jc/MyEarth
./fix-deployment.sh
```

### **Manual Application Start**
```bash
cd /home/jc/MyEarth
source venv/bin/activate
export DATABASE_URL="postgresql://postgres:myearth_password@localhost/myearth"
export PORT=5001
nohup python3 main.py > app.log 2>&1 &
```

### **Nginx Configuration**
```bash
# Run with sudo
sudo bash /home/jc/MyEarth/fix-nginx-manual.sh
```

## 🔍 Common Issues & Solutions

### **1. Application Not Starting**

**Symptoms:**
- Health check fails: `curl http://localhost:5001/api/ping`
- No process running: `ps aux | grep python3`

**Solutions:**
```bash
# Check logs
tail -f /home/jc/MyEarth/app.log

# Check virtual environment
cd /home/jc/MyEarth
source venv/bin/activate
python3 -c "import fastapi; print('FastAPI OK')"

# Reinstall dependencies
pip install -r requirements.txt --break-system-packages

# Check database connection
python3 -c "import psycopg2; print('PostgreSQL OK')"
```

### **2. Systemd Service Issues**

**Symptoms:**
- Service won't start: `systemctl status myearth`
- Permission denied errors

**Solutions:**
```bash
# Check service file
cat /home/jc/MyEarth/myearth.service

# Try user systemd service
systemctl --user daemon-reload
systemctl --user start myearth
systemctl --user status myearth

# Manual start as fallback
/home/jc/MyEarth/start-app.sh
```

### **3. Nginx Configuration Problems**

**Symptoms:**
- Domain not accessible
- 502 Bad Gateway errors
- Nginx won't reload

**Solutions:**
```bash
# Check nginx status
systemctl status nginx

# Test nginx config
nginx -t

# Check nginx logs
tail -f /var/log/nginx/error.log

# Manual nginx fix
sudo bash /home/jc/MyEarth/fix-nginx-manual.sh
```

### **4. Database Connection Issues**

**Symptoms:**
- Application crashes on startup
- Database connection errors in logs

**Solutions:**
```bash
# Check PostgreSQL status
systemctl status postgresql

# Test database connection
psql -h localhost -U postgres -d myearth -c "SELECT 1;"

# Recreate database if needed
sudo -u postgres psql -c "DROP DATABASE IF EXISTS myearth;"
sudo -u postgres psql -c "CREATE DATABASE myearth;"
sudo -u postgres psql -c "CREATE USER myearth WITH PASSWORD 'myearth_password';"
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE myearth TO myearth;"
```

### **5. Port Conflicts**

**Symptoms:**
- Port 5001 already in use
- Application can't bind to port

**Solutions:**
```bash
# Check what's using port 5001
netstat -tlnp | grep :5001
ss -tlnp | grep :5001

# Kill conflicting processes
sudo pkill -f "python3 main.py"

# Check firewall
sudo ufw status
sudo ufw allow 5001/tcp
```

## 🛠️ Diagnostic Commands

### **System Health Check**
```bash
# Check all services
systemctl status nginx postgresql

# Check disk space
df -h

# Check memory usage
free -h

# Check running processes
ps aux | grep -E "(python|nginx|postgres)"
```

### **Network Connectivity**
```bash
# Test local connectivity
curl -f http://localhost:5001/api/ping

# Test external access
curl -f http://194.230.198.246:5001/api/ping

# Check DNS resolution
nslookup myearth.app
dig myearth.app
```

### **Application Logs**
```bash
# Application logs
tail -f /home/jc/MyEarth/app.log

# Nginx logs
tail -f /var/log/nginx/access.log
tail -f /var/log/nginx/error.log

# System logs
journalctl -u myearth --no-pager -n 50
journalctl -u nginx --no-pager -n 50
```

## 🔧 Advanced Fixes

### **Complete Reset**
```bash
# Stop all services
sudo systemctl stop nginx
sudo systemctl stop myearth
pkill -f "python3 main.py"

# Clean and reinstall
cd /home/jc/MyEarth
rm -rf venv
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt --break-system-packages

# Restart services
sudo systemctl start nginx
./fix-deployment.sh
```

### **SSL Certificate Issues**
```bash
# Check certificate status
sudo certbot certificates

# Renew certificates
sudo certbot renew

# Force certificate renewal
sudo certbot renew --force-renewal
```

### **Firewall Configuration**
```bash
# Check UFW status
sudo ufw status

# Allow required ports
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw allow 5001/tcp

# Enable UFW if needed
sudo ufw enable
```

## 📞 Emergency Contacts

### **Server Access**
- **SSH**: `ssh jc@100.69.50.87`
- **Direct IP**: `http://194.230.198.246:5001`
- **Domain**: `https://myearth.app`

### **Key Files**
- **Application**: `/home/jc/MyEarth/main.py`
- **Service**: `/home/jc/MyEarth/myearth.service`
- **Nginx Config**: `/home/jc/MyEarth/nginx.conf`
- **Environment**: `/home/jc/MyEarth/.env`

### **Management Scripts**
- **Deployment Fix**: `./fix-deployment.sh`
- **Nginx Fix**: `sudo bash fix-nginx-manual.sh`
- **Start App**: `./start-app.sh`
- **Stop App**: `./stop-app.sh`

## 🎯 Success Indicators

### **✅ Healthy Deployment**
- `curl http://localhost:5001/api/ping` returns `{"message":"pong"}`
- `systemctl status nginx` shows "active (running)"
- `systemctl status myearth` shows "active (running)" (or manual process running)
- `curl http://myearth.app` returns the application

### **⚠️ Warning Signs**
- Application logs show errors
- Health check fails
- Nginx returns 502 errors
- Database connection errors

### **❌ Critical Issues**
- Application won't start
- Port conflicts
- Disk space full
- Database corruption

## 🚀 Quick Recovery Steps

1. **SSH into server**: `ssh jc@100.69.50.87`
2. **Run deployment fix**: `./fix-deployment.sh`
3. **Check health**: `curl http://localhost:5001/api/ping`
4. **Configure nginx**: `sudo bash fix-nginx-manual.sh`
5. **Test domain**: `curl http://myearth.app`

---

**Last Updated**: August 8, 2025  
**Version**: 2.0  
**Maintainer**: MyEarth.app Team 