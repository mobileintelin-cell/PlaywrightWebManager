# How to Access Command Log Monitor

## 🎯 Quick Start Guide

The Command Log Monitor is now integrated into the Playwright Web Manager Dashboard. Here's how to access and use it:

### 1. **Start the Application**
```bash
npm run server
```

### 2. **Access the Dashboard**
- Open your browser to `http://localhost:3001`
- Select a project from the project list
- You'll be taken to the Test Dashboard

### 3. **Enable Command Monitor**
- In the Test Dashboard, look for the navigation bar at the top
- Click the **"Command Monitor"** button (with Terminal icon)
- The button will highlight when active

### 4. **View Real-time Command Logs**
Once enabled, you'll see:
- **Active Commands**: Currently running Playwright commands
- **Command History**: All executed commands with status
- **Real-time Updates**: Live streaming of command output
- **Search & Filter**: Find specific commands or projects

## 🔧 Features Available

### **Real-time Monitoring**
- ✅ Live WebSocket connection status
- ✅ Active command tracking
- ✅ Real-time log streaming
- ✅ Command status updates

### **Command Management**
- ✅ View command details (command, args, environment)
- ✅ Cancel running commands
- ✅ Search and filter commands
- ✅ Clear command history

### **Detailed Views**
- ✅ List view: Overview of all commands
- ✅ Details view: Full command information
- ✅ Log output: Complete stdout/stderr
- ✅ Execution timeline

## 🎮 How to Use

### **Running Tests with Monitoring**
1. Click "Command Monitor" to enable the view
2. Run Playwright tests using the "Run Tests" card
3. Watch real-time command execution in the monitor
4. See live updates as tests progress

### **Monitoring Active Commands**
- Active commands appear at the top with blue highlighting
- Each shows: project name, command, start time
- Cancel button to stop running commands
- Real-time status updates

### **Searching Command History**
- Use the search box to find specific commands
- Filter by status: running, completed, failed, cancelled
- Filter by project name
- Auto-refresh for live updates

### **Viewing Command Details**
- Click on any command in the list
- Switch to "Details" tab for full information
- See complete logs and output
- View execution timeline and process info

## 🚨 Troubleshooting

### **Command Monitor Not Showing**
- Make sure you clicked the "Command Monitor" button
- Check that the server is running (`npm run server`)
- Verify WebSocket connection (should show "Connected" status)

### **No Commands Appearing**
- Run some Playwright tests first
- Commands only appear when tests are executed
- Check the server console for any errors

### **WebSocket Connection Issues**
- Refresh the page to reconnect
- Check browser console for connection errors
- Ensure server is running on port 3001

## 📊 Example Workflow

1. **Start Server**: `npm run server`
2. **Open Dashboard**: Navigate to `http://localhost:3001`
3. **Select Project**: Choose a Playwright project
4. **Enable Monitor**: Click "Command Monitor" button
5. **Run Tests**: Execute tests using the Run Tests card
6. **Watch Live**: See real-time command execution
7. **View Details**: Click on commands for detailed logs
8. **Search History**: Use filters to find specific commands

## 🎯 Key Benefits

- **Real-time Visibility**: See exactly what's happening during test execution
- **Debugging**: Full command output and error logs
- **Performance**: Track execution times and identify slow commands
- **Management**: Cancel stuck commands, clear old logs
- **History**: Complete audit trail of all command executions

The Command Log Monitor provides complete visibility into your Playwright automation workflow!
