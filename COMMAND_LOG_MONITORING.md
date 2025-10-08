# Command Log Monitoring System

## Overview

The Command Log Monitoring System provides real-time monitoring and logging of Playwright command executions. It includes WebSocket-based real-time streaming, comprehensive logging, and a React-based monitoring interface.

## Features

### 🔄 Real-time Monitoring
- **WebSocket Connection**: Live streaming of command execution logs
- **Active Command Tracking**: Monitor currently running commands
- **Real-time Updates**: Instant notifications of command status changes

### 📊 Comprehensive Logging
- **Command Details**: Full command, arguments, and environment information
- **Execution Timeline**: Start time, end time, and duration tracking
- **Process Information**: Process ID and exit codes
- **Output Capture**: Both stdout and stderr streams
- **Structured Logs**: Categorized log entries with timestamps

### 🔍 Advanced Filtering & Search
- **Text Search**: Search across commands, projects, and log messages
- **Status Filtering**: Filter by running, completed, failed, or cancelled
- **Project Filtering**: Filter by specific project names
- **Date Range Filtering**: Filter by execution time ranges

### 🎛️ Management Features
- **Command Cancellation**: Cancel running commands
- **Log Cleanup**: Clear old or all command logs
- **Auto-refresh**: Automatic updates of command status
- **Export Capabilities**: Access to full command history

## Architecture

### Backend Components

#### CommandLog Class
```javascript
class CommandLog {
  constructor(commandId, projectName, command, args, environment)
  // Properties: id, projectName, command, args, environment, startTime, endTime, status, exitCode, stdout, stderr, logs, processId
}
```

#### WebSocket Server
- **Port**: Same as HTTP server (3001)
- **Message Types**:
  - `command_start`: New command execution started
  - `command_complete`: Command execution finished
  - `command_cancelled`: Command was cancelled
  - `log`: New log entry added
  - `output`: New stdout/stderr output
  - `active_commands`: List of currently running commands

#### API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/command-logs` | GET | Get all command logs with filtering |
| `/api/command-logs/:commandId` | GET | Get specific command log details |
| `/api/command-logs/search` | GET | Search command logs with query and filters |
| `/api/command-logs/active` | GET | Get currently running commands |
| `/api/command-logs/:commandId/cancel` | POST | Cancel a running command |
| `/api/command-logs` | DELETE | Clear command logs |
| `/api/command-history` | GET | Get command execution history |

### Frontend Components

#### CommandLogMonitor Component
- **Real-time Updates**: WebSocket connection for live data
- **Dual View**: List view and detailed view
- **Interactive Controls**: Search, filter, and management actions
- **Status Indicators**: Visual status badges and icons

## Usage

### Starting the Server
```bash
npm run server
```

The server will start with:
- HTTP API on port 3001
- WebSocket server on ws://localhost:3001
- Command log monitoring enabled

### WebSocket Connection
```javascript
const ws = new WebSocket('ws://localhost:3001');

ws.on('message', (data) => {
  const message = JSON.parse(data.toString());
  // Handle different message types
});
```

### API Usage Examples

#### Get All Command Logs
```javascript
const response = await fetch('/api/command-logs?limit=50&status=running');
const data = await response.json();
```

#### Search Command Logs
```javascript
const response = await fetch('/api/command-logs/search?q=playwright&projectName=my-project');
const data = await response.json();
```

#### Cancel Running Command
```javascript
const response = await fetch('/api/command-logs/cmd_1234567890_abc123/cancel', {
  method: 'POST'
});
```

### React Component Integration
```tsx
import CommandLogMonitor from './components/CommandLogMonitor';

function App() {
  return (
    <div>
      <CommandLogMonitor />
    </div>
  );
}
```

## Message Types

### WebSocket Messages

#### Command Start
```json
{
  "type": "command_start",
  "data": {
    "id": "cmd_1234567890_abc123",
    "projectName": "my-project",
    "command": "npx playwright",
    "args": ["test", "--project=chromium"],
    "environment": "local",
    "startTime": "2024-01-15T10:30:00.000Z",
    "status": "running"
  }
}
```

#### Log Entry
```json
{
  "type": "log",
  "data": {
    "level": "info",
    "message": "Test execution started",
    "timestamp": "2024-01-15T10:30:01.000Z",
    "id": "cmd_1234567890_abc123"
  }
}
```

#### Output Data
```json
{
  "type": "output",
  "data": {
    "data": "Running 3 tests...",
    "timestamp": "2024-01-15T10:30:02.000Z",
    "isError": false,
    "id": "cmd_1234567890_abc123"
  }
}
```

#### Command Complete
```json
{
  "type": "command_complete",
  "data": {
    "id": "cmd_1234567890_abc123",
    "status": "completed",
    "exitCode": 0,
    "endTime": "2024-01-15T10:35:00.000Z",
    "duration": 300000
  }
}
```

## Configuration

### Environment Variables
- `PORT`: Server port (default: 3001)
- `DISPLAY`: X11 display for headed mode (default: :0)
- `PLAYWRIGHT_BROWSERS_PATH`: Playwright browsers path

### Command Log Settings
- **History Limit**: 100 commands (configurable)
- **Output Limit**: 1000 characters per stream
- **Auto-cleanup**: Old logs removed when limit exceeded

## Testing

### Test WebSocket Connection
```bash
node test-command-logs.js
```

### Manual Testing
1. Start the server: `npm run server`
2. Open browser to `http://localhost:3001`
3. Navigate to Command Log Monitor
4. Run a Playwright test
5. Observe real-time logs and updates

## Troubleshooting

### Common Issues

#### WebSocket Connection Failed
- Check if server is running on correct port
- Verify firewall settings
- Check browser console for connection errors

#### Commands Not Appearing
- Verify Playwright projects path is correct
- Check server logs for errors
- Ensure commands are being executed through the API

#### Real-time Updates Not Working
- Check WebSocket connection status
- Verify auto-refresh is enabled
- Check browser network tab for WebSocket messages

### Debug Mode
Enable debug logging by setting environment variable:
```bash
DEBUG=playwright-monitor npm run server
```

## Security Considerations

- **WebSocket Security**: Consider WSS for production
- **Command Injection**: Commands are executed in controlled environment
- **Log Sanitization**: Sensitive data should be filtered from logs
- **Access Control**: Implement authentication for production use

## Performance

### Memory Management
- Command logs are stored in memory (consider database for production)
- Automatic cleanup of old logs
- Limited output size to prevent memory issues

### Scalability
- WebSocket connections are lightweight
- Consider Redis for multi-instance deployments
- Database storage for persistent logs

## Future Enhancements

- **Database Persistence**: Store logs in database
- **Log Export**: Export logs to files
- **Advanced Analytics**: Command performance metrics
- **Notification System**: Email/Slack notifications for failures
- **Command Templates**: Save and reuse common commands
- **Multi-user Support**: User authentication and permissions
