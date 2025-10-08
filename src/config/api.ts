// API Configuration
// Change this to your server IP address for network access
// api.ts (or wherever your constants live)
export const API_BASE_URL = '/api';

// If you use websockets on the same server:
const wsScheme = window.location.protocol === 'https:' ? 'wss://' : 'ws://';
export const WS_BASE_URL = wsScheme + window.location.host;

// For development, you can use localhost instead:
// export const API_BASE_URL = 'http://localhost:3001';
// export const WS_BASE_URL = 'ws://localhost:3001';

// Helper functions
export const getApiUrl = (endpoint: string) => `${API_BASE_URL}${endpoint}`;
export const getWsUrl = () => WS_BASE_URL;
