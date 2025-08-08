#!/bin/bash

echo "🌐 MyEarth.app Nginx Configuration Fix"
echo "======================================"

# Function to check if running as root
check_root() {
    if [ "$EUID" -eq 0 ]; then
        echo "✅ Running as root - can configure nginx"
        return 0
    else
        echo "❌ Not running as root - cannot configure nginx"
        echo "💡 Run with: sudo bash /home/jc/MyEarth/fix-nginx-manual.sh"
        return 1
    fi
}

# Function to install nginx if not present
install_nginx() {
    echo "📦 Checking nginx installation..."
    
    if ! command -v nginx &> /dev/null; then
        echo "📥 Installing nginx..."
        apt update
        apt install -y nginx
        systemctl enable nginx
        systemctl start nginx
        echo "✅ Nginx installed and started"
    else
        echo "✅ Nginx already installed"
    fi
}

# Function to configure nginx with multiple fallback methods
configure_nginx() {
    echo "🔧 Configuring nginx..."
    
    # Method 1: sites-available directory (preferred)
    if [ -d /etc/nginx/sites-available ]; then
        echo "📁 Using sites-available method..."
        
        # Copy configuration
        cp /home/jc/MyEarth/nginx.conf /etc/nginx/sites-available/myearth
        
        # Create symlink
        ln -sf /etc/nginx/sites-available/myearth /etc/nginx/sites-enabled/
        
        # Remove default site if it exists
        rm -f /etc/nginx/sites-enabled/default
        
        # Test configuration
        if nginx -t; then
            systemctl reload nginx
            echo "✅ Nginx configured successfully (Method 1)"
            return 0
        else
            echo "❌ Nginx configuration test failed"
            return 1
        fi
    fi
    
    # Method 2: Modify main nginx.conf
    if [ -f /etc/nginx/nginx.conf ]; then
        echo "📄 Using main nginx.conf method..."
        
        # Backup original config
        cp /etc/nginx/nginx.conf /etc/nginx/nginx.conf.backup
        
        # Add our server block to the main config
        cat /home/jc/MyEarth/nginx.conf >> /etc/nginx/nginx.conf
        
        # Test configuration
        if nginx -t; then
            systemctl reload nginx
            echo "✅ Nginx configured successfully (Method 2)"
            return 0
        else
            echo "❌ Nginx configuration test failed, restoring backup"
            cp /etc/nginx/nginx.conf.backup /etc/nginx/nginx.conf
            return 1
        fi
    fi
    
    echo "❌ No nginx configuration method available"
    return 1
}

# Function to configure SSL with Let's Encrypt
configure_ssl() {
    echo "🔒 Configuring SSL certificate..."
    
    # Check if certbot is installed
    if ! command -v certbot &> /dev/null; then
        echo "📥 Installing certbot..."
        apt install -y certbot python3-certbot-nginx
    fi
    
    # Check if domain is accessible
    if curl -f http://myearth.app > /dev/null 2>&1; then
        echo "🌐 Domain is accessible, requesting SSL certificate..."
        certbot --nginx -d myearth.app --non-interactive --agree-tos --email admin@myearth.app
        echo "✅ SSL certificate configured"
    else
        echo "⚠️  Domain not accessible, skipping SSL configuration"
        echo "💡 Make sure DNS is pointing to this server"
    fi
}

# Function to create firewall rules
configure_firewall() {
    echo "🔥 Configuring firewall..."
    
    # Check if ufw is available
    if command -v ufw &> /dev/null; then
        ufw allow 80/tcp
        ufw allow 443/tcp
        ufw allow 5001/tcp
        echo "✅ Firewall rules configured"
    else
        echo "⚠️  UFW not available, skipping firewall configuration"
    fi
}

# Function to test the configuration
test_configuration() {
    echo "🧪 Testing configuration..."
    
    # Test HTTP
    if curl -f http://localhost/ > /dev/null 2>&1; then
        echo "✅ HTTP access working"
    else
        echo "❌ HTTP access failed"
    fi
    
    # Test HTTPS
    if curl -f https://localhost/ > /dev/null 2>&1; then
        echo "✅ HTTPS access working"
    else
        echo "⚠️  HTTPS access failed (may be normal if SSL not configured)"
    fi
    
    # Test direct app access
    if curl -f http://localhost:5001/api/ping > /dev/null 2>&1; then
        echo "✅ Direct app access working"
    else
        echo "❌ Direct app access failed"
    fi
}

# Main execution
echo "🔍 Starting nginx configuration fix..."

# Check root privileges
if ! check_root; then
    exit 1
fi

# Install nginx if needed
install_nginx

# Configure nginx
if configure_nginx; then
    echo "✅ Nginx configuration successful"
else
    echo "❌ Nginx configuration failed"
    exit 1
fi

# Configure SSL (optional)
read -p "Do you want to configure SSL certificate? (y/n): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    configure_ssl
fi

# Configure firewall
configure_firewall

# Test configuration
test_configuration

# Final status
echo ""
echo "🎯 Final Status:"
echo "================"
echo "🌐 HTTP URL: http://myearth.app"
echo "🔒 HTTPS URL: https://myearth.app"
echo "🚀 Direct URL: http://194.230.198.246:5001"

echo ""
echo "📋 Management Commands:"
echo "======================"
echo "Nginx status: systemctl status nginx"
echo "Nginx reload: systemctl reload nginx"
echo "Nginx logs:   tail -f /var/log/nginx/error.log"
echo "App logs:     tail -f /home/jc/MyEarth/app.log"

echo ""
echo "🎉 Nginx configuration completed!"
