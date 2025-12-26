#!/bin/bash

echo "=== Fixing Tailscale SSH Configuration ==="

# Disable Tailscale SSH
echo "Disabling Tailscale SSH..."
sudo tailscale up --ssh=false

# Verify the change
echo "=== Current Tailscale Status ==="
tailscale status

echo "=== SSH Service Status ==="
sudo systemctl status ssh --no-pager

echo "=== Testing regular SSH ==="
echo "You can now test SSH with: ssh jc@100.69.50.87"

echo "=== Fix completed ===" 