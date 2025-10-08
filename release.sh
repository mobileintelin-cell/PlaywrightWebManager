#!/bin/bash

# Release script for Playwright Web Manager Dashboard
# This script builds the project and deploys it to the web server

echo "🚀 Starting release process..."

# Navigate to project directory
cd "/home/pc/Documents/PlaywrightWebManager"

echo "📦 Building the project..."
npm run build

if [ $? -ne 0 ]; then
    echo "❌ Build failed! Exiting..."
    exit 1
fi

echo "🗑️ Cleaning web server directory..."
sudo rm -rf /var/www/html/*

echo "📋 Copying build files to web server..."
sudo cp -r build/* /var/www/html/

if [ $? -ne 0 ]; then
    echo "❌ Failed to copy files! Exiting..."
    exit 1
fi

echo "🔄 Reloading nginx..."
sudo systemctl reload nginx

if [ $? -eq 0 ]; then
    echo "✅ Release completed successfully!"
    echo "🌐 Your application is now live at your server IP"
else
    echo "❌ Failed to reload nginx!"
    exit 1
fi
