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

# Stop existing PM2 process if running
echo "🛑 Stopping existing PM2 processes..."
pm2 stop playwright 2>/dev/null || echo "No existing playwright process found"
pm2 delete playwright 2>/dev/null || echo "No existing playwright process to delete"

# Set the port environment variable
export PORT=3000

# Start the server using PM2
echo "🚀 Starting Playwright Web Manager Dashboard server..."
pm2 start npm --name "playwright" -- run server

# Save PM2 configuration
echo "💾 Saving PM2 configuration..."
pm2 save

# Setup PM2 startup (run this once to enable auto-start on boot)
echo "⚡ Setting up PM2 startup (auto-start on boot)..."
pm2 startup

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
echo "  Dashboard: http://localhost:3000"
echo "  Reports:   http://localhost:9323"
echo ""
echo "📋 Next steps:"
echo "  1. Open http://localhost:3000 in your browser"
echo "  2. Select a Playwright project to manage"
echo "  3. Use the 'Show Report' button to open Playwright reports"
echo ""
echo "🔧 Troubleshooting:"
echo "  - Check logs: pm2 logs playwright"
echo "  - Restart server: pm2 restart playwright"
echo "  - Check port availability: lsof -i :3000"