#!/bin/bash

# Playwright Web Manager Dashboard - Release Script
# This script handles the complete release process including server startup

set -e  # Exit on any error

echo "🎯 Playwright Web Manager Dashboard - Release Script"
echo "=================================================="
echo ""

# Check if PM2 is installed
if ! command -v pm2 &> /dev/null; then
    echo "❌ PM2 is not installed. Installing PM2..."
    npm install -g pm2
    echo "✅ PM2 installed successfully!"
else
    echo "✅ PM2 is already installed"
fi

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js first."
    exit 1
else
    echo "✅ Node.js is installed: $(node --version)"
fi

# Install dependencies if node_modules doesn't exist
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
    echo "✅ Dependencies installed successfully!"
else
    echo "✅ Dependencies already installed"
fi

# IMPORTANT: Clean build folder before building
echo "🗑️ Cleaning old build files..."
rm -rf build/
echo "✅ Old build files cleaned!"

# Build the frontend project
echo "🏗️ Building the frontend project..."
npm run build

if [ $? -ne 0 ]; then
    echo "❌ Frontend build failed! Exiting..."
    exit 1
fi
echo "✅ Frontend build completed successfully!"

# Stop existing PM2 process if running
echo "🛑 Stopping existing PM2 processes..."
pm2 stop playwright 2>/dev/null || echo "No existing playwright process found"
pm2 delete playwright 2>/dev/null || echo "No existing playwright process to delete"

# Set the port environment variable
export PORT=3000

# Start the server using PM2
echo "🚀 Starting Playwright Web Manager Dashboard server..."
pm2 start npm --name "playwright" -- run server --listen-timeout=900000

# Alternative: Use ecosystem file for better configuration
# Create ecosystem.config.js if it doesn't exist
if [ ! -f "ecosystem.config.js" ]; then
    echo "📝 Creating PM2 ecosystem configuration..."
    cat > ecosystem.config.js << 'EOF'
module.exports = {
  apps: [{
    name: 'playwright',
    script: 'npm',
    args: 'run server',
    env: {
      PORT: 3000,
      NODE_ENV: 'production'
    },
    node_args: '--max-http-header-size=16000',
    kill_timeout: 900000,
    listen_timeout: 900000,
    max_memory_restart: '1G',
    instances: 1,
    exec_mode: 'fork'
  }]
};
EOF
    echo "✅ Ecosystem configuration created!"
fi

# Save PM2 configuration
echo "💾 Saving PM2 configuration..."
pm2 save

# Setup PM2 startup (run this once to enable auto-start on boot)
echo "⚡ Setting up PM2 startup (auto-start on boot)..."
pm2 startup

# Deploy frontend to web server
echo "🌐 Deploying frontend to web server..."

# Check if nginx web directory exists
if [ -d "/var/www/html" ]; then
    echo "🗑️ Cleaning web server directory completely..."
    sudo rm -rf /var/www/html/*

    echo "📋 Copying build files to web server..."
    sudo cp -r build/* /var/www/html/

    if [ $? -ne 0 ]; then
        echo "❌ Failed to copy files to web server! Continuing with backend deployment..."
    else
        # Clear nginx cache
        echo "🧹 Clearing nginx cache..."
        sudo rm -rf /var/cache/nginx/*

        echo "🔄 Reloading nginx..."
        sudo systemctl reload nginx

        if [ $? -eq 0 ]; then
            echo "✅ Frontend deployed successfully!"
        else
            echo "⚠️ Frontend deployed but nginx reload failed!"
        fi
    fi
else
    echo "⚠️ Web server directory /var/www/html not found. Skipping frontend deployment."
    echo "   Make sure nginx is installed and configured."
fi

echo ""
echo "🎉 Release completed successfully!"
echo "=================================="
echo ""
echo "📊 Server Status:"
pm2 status
echo ""
echo "📝 Useful PM2 commands:"
echo "  pm2 status                    - Check server status"
echo "  pm2 logs playwright          - View server logs"
echo "  pm2 logs playwright --lines 50 - View last 50 log lines"
echo "  pm2 restart playwright       - Restart server"
echo "  pm2 stop playwright          - Stop server"
echo "  pm2 delete playwright        - Remove server from PM2"
echo "  pm2 monit                    - Monitor server in real-time"
echo ""
echo "🌐 Server URLs:"
echo "  Dashboard (Backend): http://localhost:3000"
echo "  Frontend (Web):      http://your-server-ip (nginx)"
echo "  Reports:             http://localhost:9323"
echo ""
echo "📋 Next steps:"
echo "  1. Open http://localhost:3000 for backend API"
echo "  2. Open http://your-server-ip for frontend web interface"
echo "  3. Select a Playwright project to manage"
echo "  4. Use the 'Show Report' button to open Playwright reports"
echo ""
echo "🔧 Troubleshooting:"
echo "  - Check logs: pm2 logs playwright"
echo "  - Restart server: pm2 restart playwright"
echo "  - Check port availability: lsof -i :3000"
echo ""
echo "💡 Clear browser cache:"
echo "  - Press: Ctrl+Shift+Delete (Windows/Linux) or Cmd+Shift+Delete (Mac)"
echo "  - Or use: Ctrl+F5 or Cmd+Shift+R to hard refresh"