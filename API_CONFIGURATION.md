# API Configuration Update

## Overview
The application has been updated to use a centralized API configuration that allows you to easily switch between localhost and your server IP address.

## Configuration File
The API configuration is located in `src/config/api.ts`:

```typescript
// API Configuration
// Change this to your server IP address for network access
export const API_BASE_URL = 'http://192.168.0.144:3000';
export const WS_BASE_URL = 'ws://0.0.0.0:3000';

// For development, you can use localhost instead:
// export const API_BASE_URL = 'http://localhost:3000';
// export const WS_BASE_URL = 'ws://localhost:3000';
```

## Benefits
1. **Network Access**: Other devices on your network can access the dashboard
2. **CORS Avoidance**: Using the same origin avoids CORS issues
3. **Easy Configuration**: Change the IP address in one place
4. **Development Flexibility**: Easy switch between localhost and network IP

## Updated Components
All components now use the centralized configuration:
- `TestDashboard.tsx` - All API calls updated
- `LiveLogsCard.tsx` - WebSocket connection updated
- `RunTestsCard.tsx` - Environment and test API calls updated
- `EnvironmentManager.tsx` - Environment management API calls updated
- `ProjectSelectionScreen.tsx` - Project search and creation API calls updated

## Usage
1. **For Network Access**: Use your server IP (192.168.0.144:3000)
2. **For Local Development**: Use localhost:3000
3. **Change Configuration**: Edit `src/config/api.ts` and restart the application

## Server Requirements
Make sure your server is accessible on the configured IP address and port. The server should be running on `192.168.0.144:3000` for network access.

## Testing
You can test the configuration by:
1. Starting the server: `npm run server`
2. Opening the dashboard in a browser
3. Checking the browser console for WebSocket connection status
4. Verifying API calls work from other devices on the network
