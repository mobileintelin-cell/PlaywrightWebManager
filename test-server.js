const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());

// Test environment configuration loading
let environmentConfig = null;

const loadEnvironmentConfig = async () => {
  try {
    const configPath = path.join(__dirname, 'environments.json');
    const configData = await fs.readFile(configPath, 'utf8');
    environmentConfig = JSON.parse(configData);
    console.log('Environment configuration loaded successfully');
    console.log('Available environments:', Object.keys(environmentConfig.environments));
  } catch (error) {
    console.error('Error loading environment configuration:', error);
  }
};

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Environment endpoint
app.get('/api/environments', async (req, res) => {
  try {
    if (!environmentConfig) {
      await loadEnvironmentConfig();
    }
    
    res.json({
      success: true,
      environments: environmentConfig.environments,
      defaultEnvironment: environmentConfig.defaultEnvironment,
      errorContext: environmentConfig.errorContext
    });
    
  } catch (error) {
    console.error('Error getting environment configuration:', error);
    res.status(500).json({ 
      error: 'Failed to get environment configuration',
      message: error.message 
    });
  }
});

app.listen(PORT, async () => {
  console.log(`Test server running on http://localhost:${PORT}`);
  
  // Load environment configuration on startup
  await loadEnvironmentConfig();
});
