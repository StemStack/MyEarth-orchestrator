#!/bin/bash

echo "=== SSH Debug Script ==="
echo "Date: $(date)"
echo "User: $(whoami)"
echo "Hostname: $(hostname)"

echo "=== SSH Service Status ==="
sudo systemctl status ssh --no-pager

echo "=== SSH Configuration ==="
sudo cat /etc/ssh/sshd_config | grep -E "(Port|PermitRootLogin|PubkeyAuthentication|AuthorizedKeysFile)" || echo "No relevant SSH config found"

echo "=== Authorized Keys ==="
ls -la ~/.ssh/
echo "--- Content of authorized_keys ---"
cat ~/.ssh/authorized_keys || echo "No authorized_keys file found"

echo "=== SSH Logs (last 20 lines) ==="
sudo tail -20 /var/log/auth.log | grep ssh || echo "No SSH logs found"

echo "=== Network Interfaces ==="
ip addr show

echo "=== Tailscale Status ==="
tailscale status || echo "Tailscale not installed"

echo "=== Listening Ports ==="
sudo netstat -tlnp | grep :22 || echo "SSH port not listening"

echo "=== Firewall Status ==="
sudo ufw status || echo "UFW not active" 