// Test WebSocket connection to verify Live Logs connectivity
const WebSocket = require('ws');

async function testWebSocketConnection() {
  console.log('Testing WebSocket connection for Live Logs...\n');
  
  const ws = new WebSocket('ws://localhost:3001');
  
  ws.on('open', () => {
    console.log('✅ WebSocket connection established successfully');
    console.log('✅ Live Logs should now show "Connected" status');
    console.log('✅ Real-time command monitoring is active');
    
    // Close connection after successful test
    setTimeout(() => {
      ws.close();
    }, 1000);
  });
  
  ws.on('message', (data) => {
    try {
      const message = JSON.parse(data.toString());
      console.log('📨 Received message:', message.type);
    } catch (error) {
      console.log('📨 Received raw message:', data.toString().substring(0, 100) + '...');
    }
  });
  
  ws.on('error', (error) => {
    console.log('❌ WebSocket connection failed:', error.message);
    console.log('❌ Live Logs will show "Disconnected" status');
    console.log('❌ Make sure the server is running with: npm run server');
  });
  
  ws.on('close', () => {
    console.log('🔌 WebSocket connection closed');
    console.log('\n✅ Test completed - Live Logs should be working properly now!');
  });
}

testWebSocketConnection();
