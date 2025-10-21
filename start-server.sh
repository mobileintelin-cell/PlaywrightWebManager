#!/bin/bash

# Script to safely start the Playwright Web Manager Dashboard server
# This script will kill any existing processes on port 3000 before starting

echo "🚀 Starting Playwright Web Manager Dashboard Server..."

# Check if port 3000 is in use
if lsof -ti:3000 > /dev/null 2>&1; then
    echo "⚠️  Port 3000 is already in use. Killing existing processes..."
    lsof -ti:3000 | xargs kill -9
    sleep 2
    echo "✅ Existing processes killed"
fi

# Start the server
echo "🎯 Starting server on port 3000..."
npm run server
