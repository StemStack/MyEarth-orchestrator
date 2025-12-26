#!/bin/bash

echo "=== Configuring Passwordless Sudo for Deployment ==="

# Create a sudoers file for the jc user
echo "jc ALL=(ALL) NOPASSWD: /usr/bin/systemctl, /usr/bin/cp, /usr/bin/mkdir, /usr/bin/chown, /usr/bin/chmod" | sudo tee /etc/sudoers.d/jc-deploy

# Set proper permissions on the sudoers file
sudo chmod 440 /etc/sudoers.d/jc-deploy

# Verify the configuration
echo "=== Testing sudo permissions ==="
sudo -n systemctl status ssh --no-pager > /dev/null 2>&1 && echo "✅ systemctl sudo works" || echo "❌ systemctl sudo failed"
sudo -n cp /etc/hosts /tmp/test-cp > /dev/null 2>&1 && echo "✅ cp sudo works" || echo "❌ cp sudo failed"

echo "=== Sudo configuration completed ==="
echo "The jc user can now run systemctl and cp commands without password" 