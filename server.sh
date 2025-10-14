#!/bin/bash

# Playwright Web Manager Dashboard - Server Startup Script
# This script starts the server using PM2 process manager

echo "🚀 Starting Playwright Web Manager Dashboard Server..."

# Set the port environment variable
export PORT=3000

# Start the server using PM2
echo "📦 Starting server with PM2..."
pm2 start npm --name "playwright" -- run server

# Save PM2 configuration
echo "💾 Saving PM2 configuration..."
pm2 save

# Setup PM2 startup (run this once to enable auto-start on boot)
echo "⚡ Setting up PM2 startup (auto-start on boot)..."
pm2 startup

echo "✅ Playwright Web Manager Dashboard server started successfully!"
echo ""
echo "📊 Server Status:"
pm2 status
echo ""
echo "📝 Useful PM2 commands:"
echo "  pm2 status          - Check server status"
echo "  pm2 logs playwright - View server logs"
echo "  pm2 restart playwright - Restart server"
echo "  pm2 stop playwright - Stop server"
echo "  pm2 delete playwright - Remove server from PM2"
echo ""
echo "🌐 Server should be accessible at: http://localhost:3000"
echo "📋 Playwright reports will be available at: http://192.168.0.144:9323"
