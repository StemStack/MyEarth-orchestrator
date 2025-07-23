#!/usr/bin/env python3
"""
Production HTTP server for serving the CesiumJS application.
Configured for Cloud Run deployment with proper port handling and error recovery.
"""

import http.server
import socketserver
import os
import time
import socket
from functools import partial

# Configure server for deployment
PORT = int(os.environ.get('PORT', 5000))
HOST = '0.0.0.0'

class CustomHTTPRequestHandler(http.server.SimpleHTTPRequestHandler):
    """Custom handler that serves index.html for root requests and handles CORS."""
    
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory='.', **kwargs)
    
    def end_headers(self):
        """Add CORS headers for better compatibility."""
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.send_header('Cache-Control', 'no-cache')
        super().end_headers()
    
    def do_GET(self):
        """Handle GET requests with proper routing."""
        if self.path == '/':
            self.path = '/index.html'
        return super().do_GET()
    
    def log_message(self, format, *args):
        """Override to provide better logging for deployment."""
        print(f"[{self.address_string()}] {format % args}")

class ReusableSocketTCPServer(socketserver.TCPServer):
    """TCP Server that allows address reuse to prevent port conflicts."""
    
    def __init__(self, *args, **kwargs):
        self.allow_reuse_address = True
        super().__init__(*args, **kwargs)

def find_available_port(start_port=5000, max_attempts=10):
    """Find an available port starting from start_port."""
    for port in range(start_port, start_port + max_attempts):
        try:
            with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
                s.bind((HOST, port))
                return port
        except OSError:
            continue
    return None

def run_server():
    """Start the HTTP server with proper configuration for deployment."""
    global PORT
    
    # For deployment, always use the PORT env variable
    # For development, find available port only if not explicitly set via environment
    if 'PORT' not in os.environ and PORT == 5000:
        available_port = find_available_port(PORT)
        if available_port and available_port != PORT:
            print(f"Port {PORT} is busy, using port {available_port}")
            PORT = available_port
    
    print(f"Starting CesiumJS production server on {HOST}:{PORT}")
    print(f"Serving application from: {os.getcwd()}")
    
    try:
        with ReusableSocketTCPServer((HOST, PORT), CustomHTTPRequestHandler) as httpd:
            print(f"✓ Server running at http://{HOST}:{PORT}/")
            print("✓ Ready for deployment")
            print("Press Ctrl+C to stop the server")
            httpd.serve_forever()
    except OSError as e:
        print(f"Error starting server: {e}")
        print("This may be due to port conflicts in development environment.")
        print("For deployment, Cloud Run will handle port assignment automatically.")
        return 1
    except KeyboardInterrupt:
        print("\n✓ Server stopped gracefully")
        return 0

if __name__ == "__main__":
    exit(run_server())