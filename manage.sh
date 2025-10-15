#!/bin/bash

# Playwright Web Manager Dashboard - Management Script
# This script provides easy management commands for the server

case "$1" in
    start)
        echo "🚀 Starting Playwright Web Manager Dashboard..."
        export PORT=3000
        pm2 start npm --name "playwright" -- run server
        pm2 save
        echo "✅ Server started successfully!"
        ;;
    stop)
        echo "🛑 Stopping Playwright Web Manager Dashboard..."
        pm2 stop playwright
        echo "✅ Server stopped successfully!"
        ;;
    restart)
        echo "🔄 Restarting Playwright Web Manager Dashboard..."
        pm2 restart playwright
        echo "✅ Server restarted successfully!"
        ;;
    status)
        echo "📊 Playwright Web Manager Dashboard Status:"
        pm2 status playwright
        ;;
    logs)
        echo "📝 Playwright Web Manager Dashboard Logs:"
        pm2 logs playwright --lines ${2:-50}
        ;;
    delete)
        echo "🗑️ Removing Playwright Web Manager Dashboard from PM2..."
        pm2 delete playwright
        echo "✅ Server removed from PM2!"
        ;;
    monitor)
        echo "📊 Opening PM2 Monitor..."
        pm2 monit
        ;;
    *)
        echo "🎯 Playwright Web Manager Dashboard - Management Script"
        echo "====================================================="
        echo ""
        echo "Usage: $0 {start|stop|restart|status|logs|delete|monitor}"
        echo ""
        echo "Commands:"
        echo "  start     - Start the server with PM2"
        echo "  stop      - Stop the server"
        echo "  restart   - Restart the server"
        echo "  status    - Show server status"
        echo "  logs      - Show server logs (default: 50 lines)"
        echo "  logs 100  - Show last 100 log lines"
        echo "  delete    - Remove server from PM2"
        echo "  monitor   - Open PM2 monitoring interface"
        echo ""
        echo "Examples:"
        echo "  ./manage.sh start"
        echo "  ./manage.sh logs 100"
        echo "  ./manage.sh restart"
        echo ""
        echo "🌐 Server URLs:"
        echo "  Dashboard: http://localhost:3000"
        echo "  Reports:   http://localhost:9323"
        ;;
esac
