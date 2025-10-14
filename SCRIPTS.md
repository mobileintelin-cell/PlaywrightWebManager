# Playwright Web Manager Dashboard - Scripts

This directory contains scripts for managing the Playwright Web Manager Dashboard server.

## Scripts Overview

### 🚀 `release.sh` - Complete Release Script
The main release script that handles the complete setup and deployment process.

```bash
./release.sh
```

**What it does:**
- Checks and installs PM2 if needed
- Verifies Node.js installation
- Installs npm dependencies
- Stops any existing server processes
- Starts the server with PM2
- Saves PM2 configuration
- Sets up auto-start on boot

### ⚡ `server.sh` - Quick Server Start
A simple script to quickly start the server with PM2.

```bash
./server.sh
```

**What it does:**
- Sets PORT=3000
- Starts server with PM2
- Saves PM2 configuration
- Sets up PM2 startup

### 🛠️ `manage.sh` - Server Management
A management script for common server operations.

```bash
./manage.sh [command]
```

**Available commands:**
- `start` - Start the server
- `stop` - Stop the server
- `restart` - Restart the server
- `status` - Show server status
- `logs` - Show server logs (default: 50 lines)
- `logs 100` - Show last 100 log lines
- `delete` - Remove server from PM2
- `monitor` - Open PM2 monitoring interface

## Usage Examples

### Initial Setup and Release
```bash
# Complete release setup
./release.sh
```

### Daily Management
```bash
# Check server status
./manage.sh status

# View recent logs
./manage.sh logs

# Restart server
./manage.sh restart

# Stop server
./manage.sh stop
```

### Quick Start
```bash
# Start server quickly
./server.sh
```

## Server Configuration

- **Port**: 3000
- **PM2 Name**: playwright
- **Dashboard URL**: http://localhost:3000
- **Reports URL**: http://192.168.0.144:9323

## PM2 Commands Reference

```bash
# Check all PM2 processes
pm2 status

# View logs
pm2 logs playwright

# Restart process
pm2 restart playwright

# Stop process
pm2 stop playwright

# Delete process
pm2 delete playwright

# Monitor processes
pm2 monit

# Save current PM2 configuration
pm2 save

# Setup auto-start on boot
pm2 startup
```

## Troubleshooting

### Server Won't Start
1. Check if port 3000 is available: `lsof -i :3000`
2. Check PM2 status: `pm2 status`
3. View logs: `pm2 logs playwright`

### PM2 Issues
1. Reinstall PM2: `npm install -g pm2`
2. Reset PM2: `pm2 kill && pm2 start npm --name "playwright" -- run server`

### Dependencies Issues
1. Clear node_modules: `rm -rf node_modules package-lock.json`
2. Reinstall: `npm install`

## Auto-Start on Boot

After running `./release.sh` or `./server.sh`, the server will automatically start when the system boots up. This is configured through PM2's startup system.

To disable auto-start:
```bash
pm2 unstartup
```

To re-enable auto-start:
```bash
pm2 startup
```
