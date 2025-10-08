const WebSocket = require('ws');

// Test WebSocket connection and command log monitoring
async function testCommandLogMonitoring() {
  console.log('Testing Command Log Monitoring...');
  
  // Test WebSocket connection
  const ws = new WebSocket('ws://localhost:3001');
  
  ws.on('open', () => {
    console.log('✅ WebSocket connection established');
  });
  
  ws.on('message', (data) => {
    try {
      const message = JSON.parse(data.toString());
      console.log('📨 Received message:', message.type);
      
      if (message.type === 'command_start') {
        console.log('🚀 Command started:', message.data.command, message.data.args.join(' '));
      } else if (message.type === 'log') {
        console.log('📝 Log entry:', message.data.level, message.data.message);
      } else if (message.type === 'output') {
        console.log('📤 Output:', message.data.data.substring(0, 100) + '...');
      } else if (message.type === 'command_complete') {
        console.log('✅ Command completed:', message.data.status, 'Exit code:', message.data.exitCode);
      }
    } catch (error) {
      console.error('Error parsing message:', error);
    }
  });
  
  ws.on('error', (error) => {
    console.error('❌ WebSocket error:', error);
  });
  
  ws.on('close', () => {
    console.log('🔌 WebSocket connection closed');
  });
  
  // Test API endpoints
  setTimeout(async () => {
    try {
      console.log('\n📊 Testing API endpoints...');
      
      // Test health endpoint
      const healthResponse = await fetch('http://localhost:3001/api/health');
      const healthData = await healthResponse.json();
      console.log('✅ Health check:', healthData);
      
      // Test command logs endpoint
      const logsResponse = await fetch('http://localhost:3001/api/command-logs');
      const logsData = await logsResponse.json();
      console.log('✅ Command logs:', logsData.logs?.length || 0, 'logs found');
      
      // Test active commands endpoint
      const activeResponse = await fetch('http://localhost:3001/api/command-logs/active');
      const activeData = await activeResponse.json();
      console.log('✅ Active commands:', activeData.count || 0, 'active commands');
      
    } catch (error) {
      console.error('❌ API test error:', error);
    }
  }, 2000);
  
  // Keep connection open for 10 seconds
  setTimeout(() => {
    ws.close();
    console.log('\n✅ Command log monitoring test completed');
    process.exit(0);
  }, 10000);
}

// Run the test
testCommandLogMonitoring().catch(console.error);
