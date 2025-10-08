# WebSocket Connection Troubleshooting

## 🚨 **Issue: Live Logs Shows "Disconnected"**

### **Root Cause**
The "Disconnected" status in Live Logs indicates that the WebSocket connection to the server has failed.

### **Common Causes & Solutions**

#### 1. **Port Already in Use (EADDRINUSE)**
**Error**: `Error: listen EADDRINUSE: address already in use :::3001`

**Solution**:
```bash
# Kill any existing processes on port 3001
lsof -ti:3001 | xargs kill -9

# Start the server
npm run server
```

#### 2. **Server Not Running**
**Symptoms**: WebSocket connection fails immediately

**Solution**:
```bash
# Start the server
npm run server

# Verify server is running
curl http://localhost:3001/api/health
```

#### 3. **Firewall/Network Issues**
**Symptoms**: Connection timeout or refused

**Solution**:
- Check if port 3001 is accessible
- Verify firewall settings
- Try accessing `http://localhost:3001` in browser

#### 4. **Browser Issues**
**Symptoms**: WebSocket connection fails in browser

**Solution**:
- Refresh the page
- Check browser console for errors
- Try a different browser
- Clear browser cache

## 🔧 **Diagnostic Steps**

### **1. Check Server Status**
```bash
# Test server health
curl http://localhost:3001/api/health

# Expected response:
# {"status":"OK","timestamp":"...","activeConnections":0,"commandLogsCount":0,"commandHistoryCount":0}
```

### **2. Test WebSocket Connection**
```bash
# Run WebSocket test
node test-websocket-connection.js

# Expected output:
# ✅ WebSocket connection established successfully
# ✅ Live Logs should now show "Connected" status
```

### **3. Check Browser Console**
Open browser developer tools and look for:
- WebSocket connection errors
- Network failures
- JavaScript errors

## ✅ **Verification**

### **Live Logs Should Show**:
- **Connection Badge**: Green "Connected" status
- **Active Commands**: Shows count of running commands
- **Entry Counter**: Shows total log entries

### **When Working Properly**:
- Real-time command logs appear instantly
- WebSocket messages are received
- Auto-scrolling works
- Command monitoring is active

## 🚀 **Quick Fix Commands**

```bash
# Complete reset (if needed)
lsof -ti:3001 | xargs kill -9
npm run server

# Test connection
node test-websocket-connection.js

# Verify in browser
# Open http://localhost:3001
# Check Live Logs shows "Connected"
```

## 📊 **Status Indicators**

| Status | Badge Color | Meaning |
|--------|-------------|---------|
| Connected | Green | WebSocket working properly |
| Disconnected | Red | WebSocket connection failed |

## 🎯 **Expected Behavior**

When everything is working:
1. **Server starts** without port conflicts
2. **WebSocket connects** automatically when Live Logs is visible
3. **Connection badge** shows "Connected" in green
4. **Real-time logs** appear as commands execute
5. **Auto-reconnection** happens if connection drops

The Live Logs should now show "Connected" and provide real-time monitoring of Playwright command execution!
