// Comprehensive WebSocket diagnostic script
const WebSocket = require('ws');
const http = require('http');

async function diagnoseWebSocket() {
  console.log('🔍 WebSocket Connection Diagnostic\n');
  
  // Test 1: Check if server is running
  console.log('1. Testing HTTP server...');
  try {
    const response = await fetch('http://localhost:3001/api/health');
    const data = await response.json();
    console.log('✅ HTTP server is running');
    console.log(`   Active connections: ${data.activeConnections}`);
    console.log(`   Command logs: ${data.commandLogsCount}`);
  } catch (error) {
    console.log('❌ HTTP server is not responding');
    console.log('   Error:', error.message);
    console.log('   Solution: Run "npm run server"');
    return;
  }
  
  // Test 2: Test WebSocket connection
  console.log('\n2. Testing WebSocket connection...');
  const ws = new WebSocket('ws://localhost:3001');
  
  return new Promise((resolve) => {
    const timeout = setTimeout(() => {
      console.log('❌ WebSocket connection timeout (5 seconds)');
      console.log('   Possible causes:');
      console.log('   - WebSocket server not properly configured');
      console.log('   - Firewall blocking WebSocket connections');
      console.log('   - Browser security restrictions');
      ws.close();
      resolve();
    }, 5000);
    
    ws.on('open', () => {
      clearTimeout(timeout);
      console.log('✅ WebSocket connection successful');
      console.log('   Ready state:', ws.readyState);
      console.log('   URL:', ws.url);
      
      // Test 3: Send a test message
      console.log('\n3. Testing message handling...');
      ws.send(JSON.stringify({ type: 'test', data: 'Hello from diagnostic' }));
      
      setTimeout(() => {
        console.log('✅ Message sent successfully');
        ws.close();
        resolve();
      }, 1000);
    });
    
    ws.on('error', (error) => {
      clearTimeout(timeout);
      console.log('❌ WebSocket connection failed');
      console.log('   Error:', error.message);
      console.log('   Code:', error.code);
      
      if (error.code === 'ECONNREFUSED') {
        console.log('   Solution: Make sure server is running on port 3001');
      } else if (error.code === 'ENOTFOUND') {
        console.log('   Solution: Check if localhost is resolving correctly');
      }
      
      resolve();
    });
    
    ws.on('close', (code, reason) => {
      console.log(`🔌 WebSocket closed: ${code} ${reason || ''}`);
    });
  });
}

// Run diagnostic
diagnoseWebSocket().then(() => {
  console.log('\n📋 Diagnostic Summary:');
  console.log('If WebSocket connection failed:');
  console.log('1. Check server is running: npm run server');
  console.log('2. Check browser console for errors');
  console.log('3. Try opening test-websocket-browser.html in browser');
  console.log('4. Check if port 3001 is accessible');
  console.log('\nIf HTTP works but WebSocket fails:');
  console.log('1. Check WebSocket server configuration');
  console.log('2. Check firewall settings');
  console.log('3. Try different browser');
});
