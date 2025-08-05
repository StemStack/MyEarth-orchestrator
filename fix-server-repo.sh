#!/bin/bash

echo "=== Fixing Server Git Repository ==="

# Navigate to the project directory
cd /home/jc/MyEarth

echo "=== Current git status ==="
git status

echo "=== Stashing any local changes ==="
git stash || echo "No changes to stash"

echo "=== Resetting to match remote ==="
git fetch origin
git reset --hard origin/main

echo "=== Cleaning untracked files ==="
git clean -fd

echo "=== Verifying repository state ==="
git status

echo "=== Checking for service file ==="
ls -la myearth.service || echo "Service file not found after cleanup"

echo "=== Repository cleanup completed ===" 