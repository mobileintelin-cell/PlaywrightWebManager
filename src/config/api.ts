// API Configuration
// Change this to your server IP address for network access
export const API_BASE_URL = 'http://192.168.0.144:3001';
export const WS_BASE_URL = 'ws://192.168.0.144:3001';

// For development, you can use localhost instead:
// export const API_BASE_URL = 'http://localhost:3001';
// export const WS_BASE_URL = 'ws://localhost:3001';

// Helper functions
export const getApiUrl = (endpoint: string) => `${API_BASE_URL}${endpoint}`;
export const getWsUrl = () => WS_BASE_URL;
