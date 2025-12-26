#!/bin/bash

echo "🔧 MyEarth.app Deployment Fix Script"
echo "====================================="

# Function to check if running as root
check_root() {
    if [ "$EUID" -eq 0 ]; then
        echo "✅ Running as root - can install systemd service"
        return 0
    else
        echo "⚠️  Not running as root - will use manual startup"
        return 1
    fi
}

# Function to install systemd service
install_systemd_service() {
    echo "📦 Installing systemd service..."
    
    # Check if service file exists
    if [ ! -f "/home/jc/MyEarth/myearth.service" ]; then
        echo "❌ Service file not found!"
        return 1
    fi
    
    # Copy service file
    cp /home/jc/MyEarth/myearth.service /etc/systemd/system/
    
    # Reload systemd and enable service
    systemctl daemon-reload
    systemctl enable myearth
    
    echo "✅ Systemd service installed and enabled"
    return 0
}

# Function to configure nginx
configure_nginx() {
    echo "🌐 Configuring Nginx..."
    
    # Check if nginx is installed
    if ! command -v nginx &> /dev/null; then
        echo "❌ Nginx not installed"
        return 1
    fi
    
    # Method 1: Try sites-available directory
    if [ -w /etc/nginx/sites-available/ ]; then
        echo "📁 Using sites-available method..."
        cp /home/jc/MyEarth/nginx.conf /etc/nginx/sites-available/myearth
        ln -sf /etc/nginx/sites-available/myearth /etc/nginx/sites-enabled/
        
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
    if [ -w /etc/nginx/nginx.conf ]; then
        echo "📄 Using main nginx.conf method..."
        cp /etc/nginx/nginx.conf /etc/nginx/nginx.conf.backup
        cat /home/jc/MyEarth/nginx.conf >> /etc/nginx/nginx.conf
        
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
    
    echo "❌ Cannot write to nginx configuration files"
    return 1
}

# Function to start application manually
start_manual() {
    echo "🚀 Starting application manually..."
    
    cd /home/jc/MyEarth
    
    # Kill any existing processes
    pkill -f "python3 main.py" || echo "No existing processes found"
    sleep 2
    
    # Activate virtual environment
    source venv/bin/activate
    
    # Set environment variables
    export DATABASE_URL="postgresql://postgres:myearth_password@localhost/myearth"
    export PORT=5001
    
    # Start application in background
    nohup python3 main.py > app.log 2>&1 &
    APP_PID=$!
    
    echo "📝 Application started with PID: $APP_PID"
    echo "📄 Log file: /home/jc/MyEarth/app.log"
    
    # Wait for startup
    sleep 5
    
    # Test health check
    if curl -f http://localhost:5001/api/ping > /dev/null 2>&1; then
        echo "✅ Application health check passed"
        return 0
    else
        echo "❌ Application health check failed"
        return 1
    fi
}

# Function to create startup script
create_startup_script() {
    echo "📝 Creating startup script..."
    
    cat > /home/jc/MyEarth/start-app.sh << 'EOF'
#!/bin/bash
cd /home/jc/MyEarth
source venv/bin/activate
export DATABASE_URL="postgresql://postgres:myearth_password@localhost/myearth"
export PORT=5001
nohup python3 main.py > app.log 2>&1 &
echo $! > app.pid
echo "Application started with PID: $(cat app.pid)"
EOF
    
    chmod +x /home/jc/MyEarth/start-app.sh
    
    # Create stop script
    cat > /home/jc/MyEarth/stop-app.sh << 'EOF'
#!/bin/bash
cd /home/jc/MyEarth
if [ -f app.pid ]; then
    PID=$(cat app.pid)
    kill $PID 2>/dev/null || echo "Process $PID not found"
    rm -f app.pid
    echo "Application stopped"
else
    pkill -f "python3 main.py"
    echo "Application stopped (force kill)"
fi
EOF
    
    chmod +x /home/jc/MyEarth/stop-app.sh
    
    echo "✅ Startup scripts created"
}

# Function to create systemd service without sudo
create_user_systemd() {
    echo "🔧 Creating user systemd service..."
    
    # Create user systemd directory
    mkdir -p ~/.config/systemd/user
    
    # Create user service file
    cat > ~/.config/systemd/user/myearth.service << EOF
[Unit]
Description=MyEarth FastAPI Application
After=network.target

[Service]
Type=simple
WorkingDirectory=/home/jc/MyEarth
Environment=PATH=/home/jc/MyEarth/venv/bin
Environment=PORT=5001
Environment=DATABASE_URL=postgresql://postgres:myearth_password@localhost/myearth
ExecStart=/home/jc/MyEarth/venv/bin/python main.py
Restart=always
RestartSec=10

[Install]
WantedBy=default.target
EOF
    
    # Enable user service
    systemctl --user daemon-reload
    systemctl --user enable myearth
    
    echo "✅ User systemd service created"
}

# Main execution
echo "🔍 Checking deployment status..."

# Check if application is running
if curl -f http://localhost:5001/api/ping > /dev/null 2>&1; then
    echo "✅ Application is already running"
else
    echo "❌ Application is not running"
    
    # Try to install systemd service if root
    if check_root; then
        if install_systemd_service; then
            systemctl start myearth
            sleep 3
            if curl -f http://localhost:5001/api/ping > /dev/null 2>&1; then
                echo "✅ Application started via systemd"
            else
                echo "❌ Systemd start failed, trying manual start"
                start_manual
            fi
        else
            echo "❌ Systemd installation failed, using manual start"
            start_manual
        fi
    else
        # Try user systemd service
        create_user_systemd
        systemctl --user start myearth
        sleep 3
        
        if curl -f http://localhost:5001/api/ping > /dev/null 2>&1; then
            echo "✅ Application started via user systemd"
        else
            echo "❌ User systemd start failed, using manual start"
            start_manual
        fi
    fi
fi

# Configure nginx if possible
if configure_nginx; then
    echo "✅ Nginx configured successfully"
else
    echo "⚠️  Nginx configuration failed - app accessible on port 5001"
fi

# Create startup scripts
create_startup_script

# Final status check
echo ""
echo "🎯 Final Status Check:"
echo "======================"

if curl -f http://localhost:5001/api/ping > /dev/null 2>&1; then
    echo "✅ Application: RUNNING"
    echo "🌐 Local URL: http://localhost:5001"
    echo "🌍 External URL: http://194.230.198.246:5001"
else
    echo "❌ Application: NOT RUNNING"
fi

# Check nginx
if curl -f http://localhost/ > /dev/null 2>&1; then
    echo "✅ Nginx: RUNNING"
    echo "🌐 Domain URL: https://myearth.app"
else
    echo "⚠️  Nginx: NOT CONFIGURED"
    echo "💡 Run: sudo bash /home/jc/MyEarth/fix-nginx-manual.sh"
fi

echo ""
echo "📋 Management Commands:"
echo "======================="
echo "Start app:   /home/jc/MyEarth/start-app.sh"
echo "Stop app:    /home/jc/MyEarth/stop-app.sh"
echo "View logs:   tail -f /home/jc/MyEarth/app.log"
echo "Check status: curl http://localhost:5001/api/ping"

echo ""
echo "🎉 Deployment fix completed!"





