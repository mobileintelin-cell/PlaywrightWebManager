// API Configuration
// For development - Vite proxy handles /api requests to backend
export const API_BASE_URL = '/api';
// const wsScheme = window.location.protocol === 'https:' ? 'wss://' : 'ws://';
// export const WS_BASE_URL = wsScheme + window.location.host;
export const WS_BASE_URL = 'ws://192.168.0.144:3000';

// For production deployment (when frontend and backend are on same server):
// export const API_BASE_URL = '/api';
// const wsScheme = window.location.protocol === 'https:' ? 'wss://' : 'ws://';
// export const WS_BASE_URL = wsScheme + window.location.host;

// Helper functions
export const getApiUrl = (endpoint: string) => `${API_BASE_URL}${endpoint}`;
export const getWsUrl = () => WS_BASE_URL;
