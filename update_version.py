#!/usr/bin/env python3
"""
Version update script for MyEarth application.
Updates version.json with current timestamp and git commit hash.
"""

import json
import subprocess
import datetime
import os
from pathlib import Path

def get_git_commit_hash():
    """Get the current git commit hash."""
    try:
        result = subprocess.run(['git', 'rev-parse', '--short', 'HEAD'], 
                              capture_output=True, text=True, check=True)
        return result.stdout.strip()
    except (subprocess.CalledProcessError, FileNotFoundError):
        return "unknown"

def get_git_branch():
    """Get the current git branch."""
    try:
        result = subprocess.run(['git', 'rev-parse', '--abbrev-ref', 'HEAD'], 
                              capture_output=True, text=True, check=True)
        return result.stdout.strip()
    except (subprocess.CalledProcessError, FileNotFoundError):
        return "unknown"

def update_version():
    """Update version.json with current timestamp and git info."""
    
    # Read current version.json
    version_file = Path("version.json")
    if version_file.exists():
        with open(version_file, 'r') as f:
            version_data = json.load(f)
    else:
            version_data = {
        "version": "0.4",
            "buildDate": "",
            "buildTimestamp": 0,
            "commitHash": "",
            "environment": "development"
        }
    
    # Update with current information
    now = datetime.datetime.utcnow()
    version_data.update({
        "buildDate": now.isoformat() + "Z",
        "buildTimestamp": int(now.timestamp()),
        "commitHash": get_git_commit_hash(),
        "environment": "production" if os.getenv("ENVIRONMENT") == "production" else "development"
    })
    
    # Write updated version.json
    with open(version_file, 'w') as f:
        json.dump(version_data, f, indent=2)
    
    print(f"✅ Updated version.json:")
    print(f"   Version: {version_data['version']}")
    print(f"   Build Date: {version_data['buildDate']}")
    print(f"   Commit Hash: {version_data['commitHash']}")
    print(f"   Environment: {version_data['environment']}")
    
    return version_data

if __name__ == "__main__":
    update_version() 