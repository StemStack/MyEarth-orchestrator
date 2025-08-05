# MyEarth Deployment Troubleshooting Guide

## Common Issues and Solutions

### 1. SSH Connection Failures

#### Problem: `appleboy/ssh-action` hangs or fails with EOF errors

**Root Causes:**
- SSH key format issues (OpenSSH vs PEM)
- Multiple keys in `authorized_keys` causing confusion
- Tailscale connection timing issues
- GitHub Actions runner network restrictions

**Solutions:**

##### A. Convert SSH Key to PEM Format
```bash
# On your local machine
ssh-keygen -p -m PEM -f ~/.ssh/github_deploy_key
```

##### B. Clean Up Authorized Keys
```bash
# On the server
cp ~/.ssh/authorized_keys ~/.ssh/authorized_keys.backup
# Remove duplicates and ensure only one key per line
sort ~/.ssh/authorized_keys | uniq > ~/.ssh/authorized_keys.clean
mv ~/.ssh/authorized_keys.clean ~/.ssh/authorized_keys
chmod 600 ~/.ssh/authorized_keys
```

##### C. Use Native SSH Instead of appleboy/ssh-action
The updated workflow now uses native SSH commands which are more reliable.

### 2. Tailscale Connection Issues

#### Problem: GitHub Actions runner can't connect to Tailscale

**Solutions:**
- Ensure `TAILSCALE_AUTHKEY` is a reusable authkey
- Add longer sleep time after Tailscale installation
- Check Tailscale ACLs allow GitHub Actions runners

### 3. FastAPI Application Issues

#### Problem: App fails to start or crashes

**Solutions:**
- Fixed `main.py` to include proper uvicorn startup
- Added systemd service for better process management
- Added health checks in deployment

## Debugging Steps

### 1. Test SSH Connection Manually
```bash
# From your local machine
ssh -v -i ~/.ssh/github_deploy_key jc@100.69.50.87
```

### 2. Run Debug Script on Server
```bash
# On the server
chmod +x debug-ssh.sh
./debug-ssh.sh
```

### 3. Test GitHub Actions Workflow
- Use the `test-ssh.yml` workflow (manual trigger)
- Check logs for detailed error messages

### 4. Verify SSH Key Format
```bash
# Check if key is PEM format
head -1 ~/.ssh/github_deploy_key
# Should start with: -----BEGIN OPENSSH PRIVATE KEY----- or -----BEGIN RSA PRIVATE KEY-----
```

## Deployment Workflow Improvements

### 1. Native SSH Commands
- More reliable than `appleboy/ssh-action`
- Better error handling and debugging
- Proper key file management

### 2. Systemd Service
- Automatic restarts on failure
- Better logging and monitoring
- Proper process management

### 3. Health Checks
- Verify app is running after deployment
- Test API endpoints
- Check systemd service status

## Environment Setup

### Required Secrets in GitHub:
- `DEPLOY_KEY`: SSH private key (PEM format)
- `TAILSCALE_AUTHKEY`: Reusable Tailscale authkey

### Server Requirements:
- Ubuntu 24.04 LTS
- Tailscale installed and configured
- SSH server running
- Python 3.9+ with virtual environment
- PostgreSQL (if using database features)

## Monitoring and Logs

### Check Application Status:
```bash
# On the server
sudo systemctl status myearth
sudo journalctl -u myearth -f
```

### Check SSH Logs:
```bash
# On the server
sudo tail -f /var/log/auth.log | grep ssh
```

### Check Application Logs:
```bash
# On the server
tail -f /home/jc/MyEarth/myearth.log
```

## Emergency Recovery

### If Deployment Fails:
1. SSH into server manually
2. Check systemd service status
3. Restart service manually if needed
4. Check logs for errors
5. Revert to previous working version if necessary

### Rollback Process:
```bash
# On the server
cd /home/jc/MyEarth
git log --oneline -5
git checkout <previous-commit-hash>
sudo systemctl restart myearth
``` 