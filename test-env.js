const fs = require('fs');
const path = require('path');

// Test environment configuration loading
try {
  const configPath = path.join(__dirname, 'environments.json');
  const configData = fs.readFileSync(configPath, 'utf8');
  const environmentConfig = JSON.parse(configData);
  
  console.log('Environment configuration loaded successfully:');
  console.log('Default environment:', environmentConfig.defaultEnvironment);
  console.log('Available environments:', Object.keys(environmentConfig.environments));
  
  Object.entries(environmentConfig.environments).forEach(([id, env]) => {
    console.log(`- ${id}: ${env.name} (${env.url || 'Custom URL'})`);
  });
  
} catch (error) {
  console.error('Error loading environment configuration:', error.message);
}
