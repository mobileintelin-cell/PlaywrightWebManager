// Test script to demonstrate the new command format with environment variables
// Using built-in fetch (Node.js 18+)

async function testCommandFormat() {
  console.log('Testing Playwright Command Format with Environment Variables...\n');
  
  try {
    // Test with a sample project (you can change this to an actual project)
    const projectName = 'test-project';
    const testData = {
      selectedTestFiles: ['example.spec.js'],
      username: 'testuser',
      password: 'testpass',
      websiteUrl: 'https://192.168.0.71:8000',
      environment: 'local',
      runWithUI: false
    };
    
    console.log('Sending test request with environment variables:');
    console.log(`- LOCAL: ${testData.websiteUrl}`);
    console.log(`- USERNAME: ${testData.username}`);
    console.log(`- PASSWORD: ***`);
    console.log(`- Project: ${projectName}`);
    console.log(`- Test files: ${testData.selectedTestFiles.join(', ')}\n`);
    
    // Note: This will fail if the project doesn't exist, but we'll see the command format in the logs
    const response = await fetch(`http://localhost:3001/api/projects/${projectName}/run-tests`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(testData)
    });
    
    const result = await response.json();
    
    if (response.ok) {
      console.log('✅ Test executed successfully');
      console.log('Command format should appear in the Live Logs as:');
      console.log(`LOCAL=${testData.websiteUrl} USERNAME=${testData.username} PASSWORD=*** npx playwright test --project=local tests/example.spec.js`);
    } else {
      console.log('❌ Test failed (expected if project doesn\'t exist)');
      console.log('Error:', result.message);
      console.log('\nBut the command format should still appear in the server logs as:');
      console.log(`LOCAL=${testData.websiteUrl} USERNAME=${testData.username} PASSWORD=*** npx playwright test --project=local tests/example.spec.js`);
    }
    
  } catch (error) {
    console.log('❌ Connection error:', error.message);
    console.log('Make sure the server is running with: npm run server');
  }
}

testCommandFormat();
