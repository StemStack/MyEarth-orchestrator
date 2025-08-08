#!/bin/bash

echo "=== Manual Nginx Configuration Fix ==="

# Check if we can write to nginx config directory
if [ -w /etc/nginx/sites-available/ ]; then
    echo "✅ Can write to nginx config directory"
else
    echo "❌ Cannot write to nginx config directory - need sudo"
    echo "Please run this script with: sudo bash fix-nginx-manual.sh"
    exit 1
fi

# Copy our nginx configuration
echo "=== Copying nginx configuration ==="
cp /home/jc/MyEarth/nginx.conf /etc/nginx/sites-available/myearth

# Create symlink
echo "=== Creating symlink ==="
ln -sf /etc/nginx/sites-available/myearth /etc/nginx/sites-enabled/

# Test nginx configuration
echo "=== Testing nginx configuration ==="
if nginx -t; then
    echo "✅ Nginx configuration is valid"
    
    # Reload nginx
    echo "=== Reloading nginx ==="
    if systemctl reload nginx; then
        echo "✅ Nginx reloaded successfully"
        echo "=== Testing web access ==="
        sleep 2
        if curl -f http://localhost/; then
            echo "✅ Web access working!"
            echo "🎉 MyEarth.app should now be accessible!"
        else
            echo "❌ Web access still not working"
            echo "=== Checking nginx status ==="
            systemctl status nginx --no-pager
        fi
    else
        echo "❌ Failed to reload nginx"
        systemctl status nginx --no-pager
    fi
else
    echo "❌ Nginx configuration has errors"
    exit 1
fi
