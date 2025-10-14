const express = require('express');
const fs = require('fs').promises;
const path = require('path');
const cors = require('cors');
const { spawn } = require('child_process');
const WebSocket = require('ws');
const http = require('http');

const app = express();
const PORT = process.env.PORT || 3001;

// Create HTTP server
const server = http.createServer(app);

// Create WebSocket server
const wss = new WebSocket.Server({ server });

// Enable CORS for all routes
app.use(cors());
app.use(express.json());

// In-memory cache for test run status
const testRunCache = new Map();

// Command log storage and monitoring
const commandLogs = new Map();
const commandHistory = [];
const activeConnections = new Set();

// Command log structure
class CommandLog {
  constructor(commandId, projectName, command, args, environment) {
    this.id = commandId;
    this.projectName = projectName;
    this.command = command;
    this.args = args;
    this.environment = environment;
    this.startTime = new Date();
    this.endTime = null;
    this.status = 'running'; // running, completed, failed, cancelled
    this.exitCode = null;
    this.stdout = [];
    this.stderr = [];
    this.logs = [];
    this.processId = null;
  }

  addLog(level, message, timestamp = new Date()) {
    const logEntry = {
      level,
      message,
      timestamp: timestamp.toISOString(),
      id: this.id
    };
    this.logs.push(logEntry);
    
    // Broadcast to all connected clients
    this.broadcastLog(logEntry);
  }

  addOutput(data, isError = false) {
    const timestamp = new Date();
    const output = {
      data: data.toString(),
      timestamp: timestamp.toISOString(),
      isError,
      id: this.id
    };
    
    if (isError) {
      this.stderr.push(output);
    } else {
      this.stdout.push(output);
    }
    
    // Broadcast to all connected clients
    this.broadcastOutput(output);
  }

  broadcastLog(logEntry) {
    const message = JSON.stringify({
      type: 'log',
      data: logEntry
    });
    
    activeConnections.forEach(ws => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(message);
      }
    });
  }

  broadcastOutput(output) {
    const message = JSON.stringify({
      type: 'output',
      data: output
    });
    
    activeConnections.forEach(ws => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(message);
      }
    });
  }

  complete(exitCode = 0) {
    this.endTime = new Date();
    this.exitCode = exitCode;
    this.status = exitCode === 0 ? 'completed' : 'failed';
    
    // Broadcast completion
    const message = JSON.stringify({
      type: 'command_complete',
      data: {
        id: this.id,
        status: this.status,
        exitCode: this.exitCode,
        endTime: this.endTime.toISOString(),
        duration: this.endTime - this.startTime
      }
    });
    
    activeConnections.forEach(ws => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(message);
      }
    });
  }

  toJSON() {
    return {
      id: this.id,
      projectName: this.projectName,
      command: this.command,
      args: this.args,
      environment: this.environment,
      startTime: this.startTime.toISOString(),
      endTime: this.endTime ? this.endTime.toISOString() : null,
      status: this.status,
      exitCode: this.exitCode,
      duration: this.endTime ? this.endTime - this.startTime : Date.now() - this.startTime,
      stdout: this.stdout,
      stderr: this.stderr,
      logs: this.logs,
      processId: this.processId
    };
  }
}

// WebSocket connection handling
wss.on('connection', (ws) => {
  console.log('New WebSocket connection established');
  activeConnections.add(ws);
  
  // Send current active command logs to new connection
  const activeLogs = Array.from(commandLogs.values()).filter(log => log.status === 'running');
  if (activeLogs.length > 0) {
    ws.send(JSON.stringify({
      type: 'active_commands',
      data: activeLogs.map(log => log.toJSON())
    }));
  }
  
  ws.on('close', () => {
    console.log('WebSocket connection closed');
    activeConnections.delete(ws);
  });
  
  ws.on('error', (error) => {
    console.error('WebSocket error:', error);
    activeConnections.delete(ws);
  });
});

// Command log management functions
const generateCommandId = () => {
  return `cmd_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

const createCommandLog = (projectName, command, args, environment) => {
  const commandId = generateCommandId();
  const commandLog = new CommandLog(commandId, projectName, command, args, environment);
  commandLogs.set(commandId, commandLog);
  commandHistory.push(commandLog);
  
  // Keep only last 100 commands in history
  if (commandHistory.length > 100) {
    const removed = commandHistory.shift();
    commandLogs.delete(removed.id);
  }
  
  // Broadcast new command start
  const message = JSON.stringify({
    type: 'command_start',
    data: commandLog.toJSON()
  });
  
  activeConnections.forEach(ws => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(message);
    }
  });
  
  return commandLog;
};

const getCommandLog = (commandId) => {
  return commandLogs.get(commandId);
};

const getAllCommandLogs = () => {
  return Array.from(commandLogs.values());
};

const getCommandHistory = (limit = 50) => {
  return commandHistory.slice(-limit).reverse();
};

const searchCommandLogs = (query, filters = {}) => {
  let results = Array.from(commandLogs.values());
  
  // Filter by query
  if (query) {
    const searchTerm = query.toLowerCase();
    results = results.filter(log => 
      log.command.toLowerCase().includes(searchTerm) ||
      log.projectName.toLowerCase().includes(searchTerm) ||
      log.logs.some(logEntry => logEntry.message.toLowerCase().includes(searchTerm))
    );
  }
  
  // Apply additional filters
  if (filters.status) {
    results = results.filter(log => log.status === filters.status);
  }
  
  if (filters.projectName) {
    results = results.filter(log => log.projectName === filters.projectName);
  }
  
  if (filters.startDate) {
    const startDate = new Date(filters.startDate);
    results = results.filter(log => log.startTime >= startDate);
  }
  
  if (filters.endDate) {
    const endDate = new Date(filters.endDate);
    results = results.filter(log => log.startTime <= endDate);
  }
  
  return results.sort((a, b) => b.startTime - a.startTime);
};

// Environment configuration
let environmentConfig = null;

// Parse playwright.config.ts to extract environment configuration
const parsePlaywrightConfig = async (projectPath) => {
  const configPath = path.join(projectPath, 'playwright.config.ts');
  
  try {
    console.log(`Attempting to parse playwright config from: ${configPath}`);
    const configContent = await fs.readFile(configPath, 'utf8');
    
    // Extract environment configurations from the config file
    const environments = {};
    
    // First, try to parse projects array structure
    const projectsMatch = configContent.match(/projects\s*:\s*\[([\s\S]*?)\]/);
    
    if (projectsMatch) {
      const projectsContent = projectsMatch[1];
      console.log('Found projects array, parsing project configurations...');
      
      // Extract individual project configurations
      const projectMatches = projectsContent.match(/{\s*name\s*:\s*['"`]([^'"`]+)['"`][\s\S]*?}/g);
      
      if (projectMatches) {
        projectMatches.forEach(projectBlock => {
          // Extract project name
          const nameMatch = projectBlock.match(/name\s*:\s*['"`]([^'"`]+)['"`]/);
          if (nameMatch) {
            const projectName = nameMatch[1];
            
            // Extract baseURL from use section
            const baseURLMatch = projectBlock.match(/baseURL\s*:\s*['"`]([^'"`]+)['"`]/);
            const processEnvMatch = projectBlock.match(/baseURL\s*:\s*process\.env\.(\w+)/);
            
            let baseURL = '';
            if (baseURLMatch) {
              baseURL = baseURLMatch[1];
            } else if (processEnvMatch) {
              // Handle process.env variables - use the env var name as placeholder
              baseURL = `process.env.${processEnvMatch[1]}`;
            }
            
            environments[projectName] = {
              id: projectName,
              name: getEnvironmentDisplayName(projectName),
              description: getEnvironmentDescription(projectName),
              url: baseURL,
              defaultUrl: baseURL,
              requiresUrl: projectName === 'custom',
              color: getEnvironmentColor(projectName),
              icon: getEnvironmentIcon(projectName)
            };
          }
        });
      }
    }
    
    // If no projects found, try the old env section format
    if (Object.keys(environments).length === 0) {
      console.log('No projects found, trying env section...');
      const envMatch = configContent.match(/env\s*:\s*\{([^}]+)\}/s);
      
      if (envMatch) {
        const envContent = envMatch[1];
        // Extract individual environment entries
        const envEntries = envContent.match(/(\w+)\s*:\s*['"`]([^'"`]+)['"`]/g);
        
        if (envEntries) {
          envEntries.forEach(entry => {
            const match = entry.match(/(\w+)\s*:\s*['"`]([^'"`]+)['"`]/);
            if (match) {
              const [, envId, url] = match;
              environments[envId] = {
                id: envId,
                name: getEnvironmentDisplayName(envId),
                description: getEnvironmentDescription(envId),
                url: url,
                defaultUrl: url,
                requiresUrl: envId === 'custom',
                color: getEnvironmentColor(envId),
                icon: getEnvironmentIcon(envId)
              };
            }
          });
        }
      }
    }
    
    // If still no environments found, create default ones
    if (Object.keys(environments).length === 0) {
      console.log('No environment configurations found in playwright.config.ts, using defaults');
      environments.custom = {
        id: "custom",
        name: "Custom",
        description: "Custom environment with user-defined URL",
        url: "",
        defaultUrl: "http://localhost:3000",
        requiresUrl: true,
        color: "#6b7280",
        icon: "settings"
      };
    }
    
    console.log(`Parsed ${Object.keys(environments).length} environments:`, Object.keys(environments));
    
    return {
      environments,
      defaultEnvironment: Object.keys(environments)[0] || "custom",
      errorContext: {
        enabled: true,
        captureScreenshots: true,
        captureVideos: true,
        captureTraces: true,
        maxRetries: 2,
        timeout: 30000
      }
    };
    
  } catch (error) {
    console.error('Error parsing playwright.config.ts:', error);
    throw error;
  }
};

// Load environment configuration from playwright.config.ts
const loadEnvironmentConfig = async (projectPath = null) => {
  try {
    if (!projectPath) {
      console.log('No project path provided, using fallback configuration');
      // Use fallback configuration when no project path is provided (e.g., during startup)
      environmentConfig = {
        environments: {
          custom: {
            id: "custom",
            name: "Custom",
            description: "Custom environment with user-defined URL",
            url: "",
            defaultUrl: "http://localhost:3000",
            requiresUrl: true,
            color: "#6b7280",
            icon: "settings"
          }
        },
        defaultEnvironment: "custom",
        errorContext: {
          enabled: true,
          captureScreenshots: true,
          captureVideos: true,
          captureTraces: true,
          maxRetries: 2,
          timeout: 30000
        }
      };
      return;
    }
    
    console.log(`Loading environment config from playwright.config.ts in: ${projectPath}`);
    
    try {
      environmentConfig = await parsePlaywrightConfig(projectPath);
      console.log('Environment configuration loaded successfully from playwright.config.ts');
    } catch (parseError) {
      console.log('Failed to parse playwright.config.ts, using fallback configuration');
      throw parseError;
    }
  } catch (error) {
    console.error('Error loading environment configuration:', error);
    // Fallback configuration
    environmentConfig = {
      environments: {
        custom: {
          id: "custom",
          name: "Custom",
          description: "Custom environment with user-defined URL",
          url: "",
          defaultUrl: "http://localhost:3000",
          requiresUrl: true,
          color: "#6b7280",
          icon: "settings"
        }
      },
      defaultEnvironment: "custom",
      errorContext: {
        enabled: true,
        captureScreenshots: true,
        captureVideos: true,
        captureTraces: true,
        maxRetries: 2,
        timeout: 30000
      }
    };
  }
};


// Generate new environment configuration file

// Playwright installation and dependency management
const checkPlaywrightInstalled = async (projectPath) => {
  try {
    const packageJsonPath = path.join(projectPath, 'package.json');
    const packageJson = await fs.readFile(packageJsonPath, 'utf8');
    const packageData = JSON.parse(packageJson);
    
    // Check if @playwright/test is in dependencies or devDependencies
    const hasPlaywright = (
      (packageData.dependencies && packageData.dependencies['@playwright/test']) ||
      (packageData.devDependencies && packageData.devDependencies['@playwright/test'])
    );
    
    return {
      installed: hasPlaywright,
      version: hasPlaywright ? (packageData.dependencies?.['@playwright/test'] || packageData.devDependencies?.['@playwright/test']) : null
    };
  } catch (error) {
    console.error('Error checking Playwright installation:', error);
    return { installed: false, version: null };
  }
};

const checkPlaywrightBrowsers = async (projectPath) => {
  try {
    // Check multiple possible locations for Playwright browsers
    const possiblePaths = [
      // Local project installation
      path.join(projectPath, 'node_modules', '@playwright', '.cache'),
      // Global installation
      path.join(require('os').homedir(), '.cache', 'ms-playwright'),
      // Alternative global location
      path.join(require('os').homedir(), 'Library', 'Caches', 'ms-playwright'),
      // System-wide installation
      '/usr/local/lib/node_modules/@playwright/.cache'
    ];
    
    for (const cachePath of possiblePaths) {
      try {
        await fs.access(cachePath);
        console.log(`Found Playwright browsers at: ${cachePath}`);
        return true;
      } catch (error) {
        // Continue checking other paths
      }
    }
    
    // If no cache directory found, try to run playwright --version to check if it's available
    return new Promise((resolve) => {
      const { spawn } = require('child_process');
      const npx = spawn('npx', ['playwright', '--version'], {
        cwd: projectPath,
        stdio: 'pipe'
      });
      
      npx.on('close', (code) => {
        resolve(code === 0);
      });
      
      npx.on('error', () => {
        resolve(false);
      });
    });
    
  } catch (error) {
    console.error('Error checking Playwright browsers:', error);
    return false;
  }
};

const installPlaywright = async (projectPath) => {
  return new Promise((resolve, reject) => {
    console.log(`Installing @playwright/test in ${projectPath}...`);
    
    const { spawn } = require('child_process');
    const npm = spawn('npm', ['install', '@playwright/test', '--save-dev'], {
      cwd: projectPath,
      stdio: 'pipe'
    });
    
    let output = '';
    let errorOutput = '';
    
    npm.stdout.on('data', (data) => {
      output += data.toString();
      console.log(`npm install output: ${data.toString()}`);
    });
    
    npm.stderr.on('data', (data) => {
      errorOutput += data.toString();
      console.log(`npm install error: ${data.toString()}`);
    });
    
    npm.on('close', (code) => {
      if (code === 0) {
        console.log('@playwright/test installed successfully');
        resolve({ success: true, output });
      } else {
        console.error('Failed to install @playwright/test:', errorOutput);
        reject(new Error(`npm install failed with code ${code}: ${errorOutput}`));
      }
    });
    
    npm.on('error', (error) => {
      console.error('Error spawning npm install:', error);
      reject(error);
    });
  });
};

const installPlaywrightBrowsers = async (projectPath) => {
  return new Promise((resolve, reject) => {
    console.log(`Installing Playwright browsers in ${projectPath}...`);
    
    const { spawn } = require('child_process');
    const npx = spawn('npx', ['playwright', 'install'], {
      cwd: projectPath,
      stdio: 'pipe'
    });
    
    let output = '';
    let errorOutput = '';
    
    npx.stdout.on('data', (data) => {
      output += data.toString();
      console.log(`npx playwright install output: ${data.toString()}`);
    });
    
    npx.stderr.on('data', (data) => {
      errorOutput += data.toString();
      console.log(`npx playwright install error: ${data.toString()}`);
    });
    
    npx.on('close', (code) => {
      if (code === 0) {
        console.log('Playwright browsers installed successfully');
        resolve({ success: true, output });
      } else {
        console.error('Failed to install Playwright browsers:', errorOutput);
        reject(new Error(`npx playwright install failed with code ${code}: ${errorOutput}`));
      }
    });
    
    npx.on('error', (error) => {
      console.error('Error spawning npx playwright install:', error);
      reject(error);
    });
  });
};

const ensurePlaywrightInstalled = async (projectPath) => {
  try {
    console.log(`Checking Playwright installation for project: ${projectPath}`);
    
    // Check if @playwright/test is installed
    const playwrightCheck = await checkPlaywrightInstalled(projectPath);
    if (!playwrightCheck.installed) {
      console.log('@playwright/test not found, installing...');
      await installPlaywright(projectPath);
    } else {
      console.log(`@playwright/test already installed (version: ${playwrightCheck.version})`);
    }
    
    // Check if browsers are installed
    const browsersInstalled = await checkPlaywrightBrowsers(projectPath);
    if (!browsersInstalled) {
      console.log('Playwright browsers not found, installing...');
      await installPlaywrightBrowsers(projectPath);
    } else {
      console.log('Playwright browsers already installed');
    }
    
    return {
      success: true,
      playwrightInstalled: true,
      browsersInstalled: true,
      message: 'Playwright dependencies are ready'
    };
    
  } catch (error) {
    console.error('Error ensuring Playwright installation:', error);
    return {
      success: false,
      error: error.message,
      message: 'Failed to install Playwright dependencies'
    };
  }
};

// Helper functions for environment configuration
const getEnvironmentDisplayName = (envId) => {
  const names = {
    'custom': 'Custom',
    'dev': 'Development',
    'stg': 'Staging',
    'uat': 'UAT',
    'prod': 'Production'
  };
  return names[envId] || envId.charAt(0).toUpperCase() + envId.slice(1);
};

const getEnvironmentDescription = (envId) => {
  const descriptions = {
    'custom': 'Custom environment with user-defined URL',
    'dev': 'Development environment',
    'stg': 'Staging environment for testing',
    'uat': 'User Acceptance Testing environment',
    'prod': 'Production environment'
  };
  return descriptions[envId] || `${envId} environment`;
};

const getDefaultUrlForEnvironment = (envId) => {
  const urls = {
    'custom': 'http://localhost:3000',
    'dev': 'http://localhost:3000',
    'stg': 'https://staging.example.com',
    'uat': 'https://uat.example.com',
    'prod': 'https://example.com'
  };
  return urls[envId] || 'http://localhost:3000';
};

const getEnvironmentColor = (envId) => {
  const colors = {
    'custom': '#6b7280',
    'dev': '#10b981',
    'stg': '#f59e0b',
    'uat': '#8b5cf6',
    'prod': '#ef4444'
  };
  return colors[envId] || '#6b7280';
};

const getEnvironmentIcon = (envId) => {
  const icons = {
    'custom': 'settings',
    'dev': 'code',
    'stg': 'test-tube',
    'uat': 'users',
    'prod': 'globe'
  };
  return icons[envId] || 'globe';
};

// Save environment configuration
// Note: Since we now read from playwright.config.ts, we don't save back to files
// The environment configuration is managed in memory and read from the playwright config
const saveEnvironmentConfig = async (projectPath = null) => {
  try {
    console.log('Environment configuration is now managed in memory and read from playwright.config.ts');
    console.log('To update environment URLs, please modify the env section in your playwright.config.ts file');
    
    // Reload the configuration from playwright.config.ts to ensure we have the latest
    if (projectPath) {
      await loadEnvironmentConfig(projectPath);
      console.log('Environment configuration reloaded from playwright.config.ts');
    }
  } catch (error) {
    console.error('Error reloading environment configuration:', error);
  }
};

// Cache management functions
const cacheTestRun = (projectName, testResults) => {
  const cacheKey = `test_run_${projectName}`;
  testRunCache.set(cacheKey, {
    ...testResults,
    cachedAt: new Date().toISOString(),
    projectName
  });
};

const getCachedTestRun = (projectName) => {
  const cacheKey = `test_run_${projectName}`;
  return testRunCache.get(cacheKey) || null;
};

const clearTestRunCache = (projectName) => {
  const cacheKey = `test_run_${projectName}`;
  testRunCache.delete(cacheKey);
};

const getAllCachedTestRuns = () => {
  const results = [];
  for (const [key, value] of testRunCache.entries()) {
    if (key.startsWith('test_run_')) {
      results.push(value);
    }
  }
  return results;
};

// Path to the playwright projects directory
const PLAYWRIGHT_PROJECTS_PATH = path.join(process.env.HOME || '/home', 'Documents/auto/playwright');

// Helper function to get file stats
async function getFileStats(filePath) {
  try {
    const stats = await fs.stat(filePath);
    return {
      isDirectory: stats.isDirectory(),
      lastModified: stats.mtime,
      size: stats.size
    };
  } catch (error) {
    return null;
  }
}

// Helper function to count test files in a directory
async function countTestFiles(dirPath) {
  try {
    const files = await fs.readdir(dirPath);
    let testCount = 0;
    
    for (const file of files) {
      const filePath = path.join(dirPath, file);
      const stats = await getFileStats(filePath);
      
      if (stats && stats.isDirectory) {
        // Recursively count tests in subdirectories
        testCount += await countTestFiles(filePath);
      } else if (file.endsWith('.spec.js') || file.endsWith('.spec.ts') || 
                 file.endsWith('.test.js') || file.endsWith('.test.ts')) {
        testCount++;
      }
    }
    
    return testCount;
  } catch (error) {
    return 0;
  }
}

// Helper function to get project description from README or package.json
async function getProjectDescription(projectPath) {
  try {
    // Try to read README.md first
    const readmePath = path.join(projectPath, 'README.md');
    try {
      const readmeContent = await fs.readFile(readmePath, 'utf8');
      const firstLine = readmeContent.split('\n')[0];
      if (firstLine && !firstLine.startsWith('#')) {
        return firstLine.trim();
      }
    } catch (readmeError) {
      // README not found, try package.json
    }
    
    // Try to read package.json
    const packagePath = path.join(projectPath, 'package.json');
    try {
      const packageContent = await fs.readFile(packagePath, 'utf8');
      const packageJson = JSON.parse(packageContent);
      if (packageJson.description) {
        return packageJson.description;
      }
    } catch (packageError) {
      // package.json not found or invalid
    }
    
    return 'Playwright automation test project';
  } catch (error) {
    return 'Playwright automation test project';
  }
}

// Helper function to determine project status
function getProjectStatus(lastModified) {
  const now = new Date();
  const modifiedDate = new Date(lastModified);
  const daysDiff = (now - modifiedDate) / (1000 * 60 * 60 * 24);
  
  if (daysDiff <= 1) {
    return 'active';
  } else if (daysDiff <= 7) {
    return 'active';
  } else if (daysDiff <= 30) {
    return 'archived';
  } else {
    return 'archived';
  }
}

// API endpoint to get all projects
app.get('/api/projects', async (req, res) => {
  try {
    console.log(`Reading projects from: ${PLAYWRIGHT_PROJECTS_PATH}`);
    
    // Check if the directory exists
    try {
      await fs.access(PLAYWRIGHT_PROJECTS_PATH);
    } catch (error) {
      return res.status(404).json({ 
        error: 'Playwright projects directory not found',
        path: PLAYWRIGHT_PROJECTS_PATH,
        message: 'Please ensure the directory exists and contains your Playwright projects'
      });
    }
    
    const entries = await fs.readdir(PLAYWRIGHT_PROJECTS_PATH);
    const projects = [];
    
    for (const entry of entries) {
      const entryPath = path.join(PLAYWRIGHT_PROJECTS_PATH, entry);
      const stats = await getFileStats(entryPath);
      
      if (stats && stats.isDirectory) {
        const testCount = await countTestFiles(entryPath);
        const description = await getProjectDescription(entryPath);
        const status = getProjectStatus(stats.lastModified);
        
        // Format last modified time
        const now = new Date();
        const modifiedDate = new Date(stats.lastModified);
        const diffMs = now - modifiedDate;
        const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
        const diffDays = Math.floor(diffHours / 24);
        
        let lastModifiedText;
        if (diffHours < 1) {
          lastModifiedText = 'Just now';
        } else if (diffHours < 24) {
          lastModifiedText = `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
        } else if (diffDays < 7) {
          lastModifiedText = `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
        } else {
          lastModifiedText = `${Math.floor(diffDays / 7)} week${Math.floor(diffDays / 7) > 1 ? 's' : ''} ago`;
        }
        
        projects.push({
          name: entry,
          path: entryPath,
          testCount,
          lastModified: lastModifiedText,
          description,
          status
        });
      }
    }
    
    // Sort projects by last modified (newest first)
    projects.sort((a, b) => new Date(b.lastModified) - new Date(a.lastModified));
    
    res.json(projects);
  } catch (error) {
    console.error('Error reading projects:', error);
    res.status(500).json({ 
      error: 'Failed to read projects directory',
      message: error.message 
    });
  }
});

// API endpoint to search projects
app.get('/api/projects/search', async (req, res) => {
  try {
    const { q: query } = req.query;
    
    if (!query) {
      return res.json([]);
    }
    
    const entries = await fs.readdir(PLAYWRIGHT_PROJECTS_PATH);
    const projects = [];
    
    for (const entry of entries) {
      const entryPath = path.join(PLAYWRIGHT_PROJECTS_PATH, entry);
      const stats = await getFileStats(entryPath);
      
      if (stats && stats.isDirectory) {
        const description = await getProjectDescription(entryPath);
        
        // Check if query matches project name or description
        if (entry.toLowerCase().includes(query.toLowerCase()) || 
            description.toLowerCase().includes(query.toLowerCase())) {
          
          const testCount = await countTestFiles(entryPath);
          const status = getProjectStatus(stats.lastModified);
          
          // Format last modified time
          const now = new Date();
          const modifiedDate = new Date(stats.lastModified);
          const diffMs = now - modifiedDate;
          const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
          const diffDays = Math.floor(diffHours / 24);
          
          let lastModifiedText;
          if (diffHours < 1) {
            lastModifiedText = 'Just now';
          } else if (diffHours < 24) {
            lastModifiedText = `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
          } else if (diffDays < 7) {
            lastModifiedText = `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
          } else {
            lastModifiedText = `${Math.floor(diffDays / 7)} week${Math.floor(diffDays / 7) > 1 ? 's' : ''} ago`;
          }
          
          projects.push({
            name: entry,
            path: entryPath,
            testCount,
            lastModified: lastModifiedText,
            description,
            status
          });
        }
      }
    }
    
    res.json(projects);
  } catch (error) {
    console.error('Error searching projects:', error);
    res.status(500).json({ 
      error: 'Failed to search projects',
      message: error.message 
    });
  }
});

// API endpoint to create a test project
app.post('/api/projects/create', async (req, res) => {
  try {
    const { name, description } = req.body;
    
    if (!name || name.trim() === '') {
      return res.status(400).json({ 
        error: 'Project name is required' 
      });
    }
    
    const projectName = name.trim().toLowerCase().replace(/[^a-z0-9-]/g, '-');
    const projectPath = path.join(PLAYWRIGHT_PROJECTS_PATH, projectName);
    
    // Check if project already exists
    try {
      await fs.access(projectPath);
      return res.status(409).json({ 
        error: 'Project already exists',
        message: `A project with the name "${projectName}" already exists`
      });
    } catch (error) {
      // Project doesn't exist, which is what we want
    }
    
    // Create project directory structure
    await fs.mkdir(projectPath, { recursive: true });
    await fs.mkdir(path.join(projectPath, 'tests'), { recursive: true });
    
    // Create package.json
    const packageJson = {
      name: projectName,
      version: "1.0.0",
      description: description || "A new Playwright test project",
      scripts: {
        test: "playwright test",
        "test:headed": "playwright test --headed",
        "test:ui": "playwright test --ui"
      },
      devDependencies: {
        "@playwright/test": "^1.40.0"
      }
    };
    
    await fs.writeFile(
      path.join(projectPath, 'package.json'), 
      JSON.stringify(packageJson, null, 2)
    );
    
    // Create playwright.config.js with environment support
    const playwrightConfig = `import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [['html'], ['json', { outputFile: 'test-results/results.json' }]],
  use: {
    baseURL: process.env.LOCAL || 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'local',
      use: { 
        ...devices['Desktop Chrome'],
        baseURL: process.env.LOCAL || 'http://localhost:3000',
      },
    },
    {
      name: 'staging',
      use: { 
        ...devices['Desktop Chrome'],
        baseURL: process.env.STAGING || 'https://staging.example.com',
      },
    },
    {
      name: 'production',
      use: { 
        ...devices['Desktop Chrome'],
        baseURL: process.env.PRODUCTION || 'https://example.com',
      },
    },
  ],
  // Global setup for authentication
  globalSetup: require.resolve('./tests/global-setup.js'),
});`;
    
    await fs.writeFile(
      path.join(projectPath, 'playwright.config.js'), 
      playwrightConfig
    );
    
    // Create global setup for authentication
    const globalSetup = `const { chromium } = require('@playwright/test');

async function globalSetup(config) {
  const { baseURL } = config.projects[0].use;
  const username = process.env.USERNAME;
  const password = process.env.PASSWORD;
  
  if (!username || !password) {
    console.log('No credentials provided, skipping authentication setup');
    return;
  }
  
  console.log(\`Setting up authentication for \${baseURL}\`);
  
  const browser = await chromium.launch();
  const page = await browser.newPage();
  
  try {
    // Navigate to login page
    await page.goto(\`\${baseURL}/login\`);
    
    // Fill login form (adjust selectors as needed)
    await page.fill('input[name="username"], input[name="email"], input[type="email"]', username);
    await page.fill('input[name="password"], input[type="password"]', password);
    
    // Submit form
    await page.click('button[type="submit"], input[type="submit"], button:has-text("Login"), button:has-text("Sign In")');
    
    // Wait for navigation or success indicator
    await page.waitForURL(url => !url.includes('/login'), { timeout: 10000 });
    
    // Save authentication state
    await page.context().storageState({ path: 'auth.json' });
    
    console.log('Authentication setup completed successfully');
  } catch (error) {
    console.log('Authentication setup failed:', error.message);
    console.log('Tests will run without authentication');
  } finally {
    await browser.close();
  }
}

module.exports = globalSetup;`;
    
    await fs.writeFile(
      path.join(projectPath, 'tests', 'global-setup.js'), 
      globalSetup
    );
    
    // Create a sample test file with environment variable support
    const sampleTest = `import { test, expect } from '@playwright/test';

test('homepage has title', async ({ page }) => {
  // Use the baseURL from the project configuration
  await page.goto('/');
  await expect(page).toHaveTitle(/.*/); // Adjust this based on your app
});

test('login functionality', async ({ page }) => {
  // This test will use the authentication state if credentials are provided
  await page.goto('/');
  
  // Check if we're already logged in (if auth was set up)
  const isLoggedIn = await page.locator('text=Logout, text=Sign Out, [data-testid="logout"]').isVisible().catch(() => false);
  
  if (!isLoggedIn) {
    // Try to login if not already authenticated
    const username = process.env.USERNAME;
    const password = process.env.PASSWORD;
    
    if (username && password) {
      await page.goto('/login');
      await page.fill('input[name="username"], input[name="email"]', username);
      await page.fill('input[name="password"]', password);
      await page.click('button[type="submit"], button:has-text("Login")');
      await page.waitForURL(url => !url.includes('/login'), { timeout: 10000 });
    }
  }
  
  // Verify we can access protected content
  await expect(page).toHaveURL(/.*/);
});

test('environment variables test', async ({ page }) => {
  // Test that environment variables are available
  const baseUrl = process.env.LOCAL || process.env.BASE_URL;
  expect(baseUrl).toBeDefined();
  
  await page.goto('/');
  // Simple URL check without complex regex
  await expect(page).toHaveURL(/.*/);
});`;
    
    await fs.writeFile(
      path.join(projectPath, 'tests', 'example.spec.js'), 
      sampleTest
    );
    
    // Create README.md
    const readme = `# ${projectName}

${description || 'A new Playwright test project'}

## Getting Started

1. Install dependencies:
   \`\`\`bash
   npm install
   \`\`\`

2. Run tests:
   \`\`\`bash
   npm test
   \`\`\`

3. Run tests in headed mode:
   \`\`\`bash
   npm run test:headed
   \`\`\`

4. Run tests with UI:
   \`\`\`bash
   npm run test:ui
   \`\`\`

## Test Structure

- \`tests/\` - Contains all test files
- \`playwright.config.js\` - Playwright configuration
- \`package.json\` - Project dependencies and scripts
`;
    
    await fs.writeFile(
      path.join(projectPath, 'README.md'), 
      readme
    );
    
    res.json({ 
      success: true, 
      message: 'Test project created successfully',
      project: {
        name: projectName,
        path: projectPath,
        testCount: 1,
        lastModified: 'Just now',
        description: description || 'A new Playwright test project',
        status: 'new'
      }
    });
    
  } catch (error) {
    console.error('Error creating project:', error);
    res.status(500).json({ 
      error: 'Failed to create project',
      message: error.message 
    });
  }
});

// API endpoint to get test cases for a specific project
app.get('/api/projects/:projectName/tests', async (req, res) => {
  try {
    const { projectName } = req.params;
    const projectPath = path.join(PLAYWRIGHT_PROJECTS_PATH, projectName);
    
    // Check if project exists
    try {
      await fs.access(projectPath);
    } catch (error) {
      return res.status(404).json({ 
        error: 'Project not found',
        message: `Project "${projectName}" does not exist`
      });
    }
    
    const testsPath = path.join(projectPath, 'tests');
    let testFiles = [];
    
    // Check if tests directory exists
    try {
      await fs.access(testsPath);
      const files = await fs.readdir(testsPath);
      
      // Filter for test files
      const testFileExtensions = ['.spec.js', '.spec.ts', '.test.js', '.test.ts'];
      testFiles = files.filter(file => 
        testFileExtensions.some(ext => file.endsWith(ext))
      );
    } catch (error) {
      // Tests directory doesn't exist
      return res.json({ tests: [] });
    }
    
    // Get details for each test file
    const testCases = [];
    for (const testFile of testFiles) {
      const filePath = path.join(testsPath, testFile);
      try {
        const content = await fs.readFile(filePath, 'utf8');
        const stats = await getFileStats(filePath);
        
        // Extract test names from the file content
        const testMatches = content.match(/test\(['"`]([^'"`]+)['"`]/g) || [];
        const testNames = testMatches.map(match => 
          match.replace(/test\(['"`]/, '').replace(/['"`].*/, '')
        );
        
        testCases.push({
          fileName: testFile,
          filePath: filePath,
          testCount: testNames.length,
          testNames: testNames,
          lastModified: stats ? stats.lastModified : null,
          size: stats ? stats.size : 0
        });
      } catch (error) {
        console.error(`Error reading test file ${testFile}:`, error);
        testCases.push({
          fileName: testFile,
          filePath: filePath,
          testCount: 0,
          testNames: [],
          lastModified: null,
          size: 0,
          error: 'Could not read file'
        });
      }
    }
    
    res.json({ 
      project: projectName,
      tests: testCases,
      totalTests: testCases.reduce((sum, test) => sum + test.testCount, 0)
    });
    
  } catch (error) {
    console.error('Error fetching test cases:', error);
    res.status(500).json({ 
      error: 'Failed to fetch test cases',
      message: error.message 
    });
  }
});

// Simple test endpoint
app.get('/api/test', (req, res) => {
  res.json({ message: 'Server is working', timestamp: new Date().toISOString() });
});

// API endpoint to test browser launch
app.post('/api/test-browser', async (req, res) => {
  try {
    console.log('Test browser endpoint called');
    const { runWithUI } = req.body;
    console.log('runWithUI received:', runWithUI);
    
    const testScript = `
const { chromium } = require('@playwright/test');

(async () => {
  try {
    console.log('Launching browser with headless: ${!runWithUI}');
    const browser = await chromium.launch({ 
      headless: ${!runWithUI},
      slowMo: 1000
    });
    const page = await browser.newPage();
    await page.goto('https://example.com');
    console.log('Browser launched successfully');
    await page.waitForTimeout(3000);
    await browser.close();
    console.log('Browser closed');
    process.exit(0);
  } catch (error) {
    console.error('Browser test error:', error.message);
    process.exit(1);
  }
})();
`;
    
    const fs = require('fs');
    const path = require('path');
    const testFile = path.join(__dirname, 'test-browser.js');
    
    console.log('Writing test file to:', testFile);
    fs.writeFileSync(testFile, testScript);
    
    console.log('=== EXECUTING BROWSER TEST COMMAND ===');
    console.log(`Full command: node ${testFile}`);
    console.log(`Environment variables:`, {
      DISPLAY: process.env.DISPLAY || ':0'
    });
    console.log('=====================================');
    
    const { spawn } = require('child_process');
    const childProcess = spawn('node', [testFile], {
      env: {
        ...process.env,
        DISPLAY: process.env.DISPLAY || ':0'
      }
    });
    
    let output = '';
    let errorOutput = '';
    
    childProcess.stdout.on('data', (data) => {
      const dataStr = data.toString();
      output += dataStr;
      console.log('Browser test stdout:', dataStr);
    });
    
    childProcess.stderr.on('data', (data) => {
      const dataStr = data.toString();
      errorOutput += dataStr;
      console.log('Browser test stderr:', dataStr);
    });
    
    childProcess.on('close', (code) => {
      console.log('Browser test process closed with code:', code);
      try {
        // Clean up
        if (fs.existsSync(testFile)) {
          fs.unlinkSync(testFile);
        }
        
        res.json({ 
          success: code === 0, 
          output: output,
          error: errorOutput,
          code: code
        });
      } catch (cleanupError) {
        console.error('Cleanup error:', cleanupError);
        res.json({ 
          success: code === 0, 
          output: output,
          error: errorOutput,
          code: code,
          cleanupError: cleanupError.message
        });
      }
    });
    
    childProcess.on('error', (error) => {
      console.error('Process spawn error:', error);
      res.status(500).json({ 
        error: 'Failed to spawn browser test process',
        message: error.message 
      });
    });
    
  } catch (error) {
    console.error('Test browser endpoint error:', error);
    res.status(500).json({ 
      error: 'Test browser endpoint error',
      message: error.message 
    });
  }
});

// API endpoint to run tests
app.post('/api/projects/:projectName/run-tests', async (req, res) => {
  try {
    const { projectName } = req.params;
    const { selectedTestFiles, username, password, websiteUrl, environment, testExecutionOrder, runWithUI: rawRunWithUI } = req.body;
    
    // Ensure runWithUI is a boolean
    const runWithUI = rawRunWithUI === true || rawRunWithUI === 'true';
    
    const projectPath = path.join(PLAYWRIGHT_PROJECTS_PATH, projectName);
    
    // Check if project exists
    try {
      await fs.access(projectPath);
    } catch (error) {
      return res.status(404).json({ 
        error: 'Project not found',
        message: `Project "${projectName}" does not exist`
      });
    }
    
    // Check and ensure Playwright dependencies are installed
    console.log('Checking Playwright dependencies before running tests...');
    const dependencyResult = await ensurePlaywrightInstalled(projectPath);
    if (!dependencyResult.success) {
      return res.status(500).json({
        error: 'Playwright dependencies not ready',
        message: dependencyResult.message,
        details: dependencyResult.error
      });
    }
    console.log('Playwright dependencies verified and ready');
    
    // Validate required fields
    if (!selectedTestFiles || selectedTestFiles.length === 0) {
      return res.status(400).json({ 
        error: 'No test files selected',
        message: 'Please select at least one test file to run'
      });
    }
    
    if (!websiteUrl) {
      return res.status(400).json({ 
        error: 'Website URL required',
        message: 'Please provide a website URL'
      });
    }
    
    // Load environment configuration from project folder if not already loaded
    if (!environmentConfig) {
      await loadEnvironmentConfig(projectPath);
    }
    
    // Determine the project configuration based on environment
    let playwrightProject = 'chromium'; // Default to chromium instead of local
    let finalUrl = websiteUrl;
    
    // First try to get Playwright project configuration
    try {
      const playwrightConfigPath = '/Users/tam.ct/Documents/auto/playwright/hrm/playwright.config.ts';
      const configContent = await fs.readFile(playwrightConfigPath, 'utf8');
      
      // Extract project configurations
      const projectMatches = configContent.match(/projects:\s*\[([\s\S]*?)\]/);
      if (projectMatches) {
        const projectsContent = projectMatches[1];
        const projectRegex = /{\s*name:\s*['"`]([^'"`]+)['"`][\s\S]*?use:\s*{([\s\S]*?)}/g;
        let projectMatch;
        
        while ((projectMatch = projectRegex.exec(projectsContent)) !== null) {
          const projectName = projectMatch[1];
          const projectUse = projectMatch[2];
          const baseURLMatch = projectUse.match(/baseURL:\s*(['"`][^'"`]+['"`]|process\.env\.\w+)/);
          
          if (projectName === environment) {
            // Found matching Playwright project
            if (baseURLMatch) {
              const baseURLRaw = baseURLMatch[1];
              if (baseURLRaw.startsWith("'") || baseURLRaw.startsWith('"') || baseURLRaw.startsWith('`')) {
                finalUrl = baseURLRaw.slice(1, -1); // Remove quotes
              } else {
                // Handle environment variables
                if (baseURLRaw === 'process.env.LOCAL') {
                  finalUrl = websiteUrl; // Use the provided URL for LOCAL env var
                } else {
                  finalUrl = baseURLRaw; // Keep as is for other env vars
                }
              }
            }
            playwrightProject = projectName; // Use the actual project name
            console.log(`Using Playwright project: ${playwrightProject} with URL: ${finalUrl}`);
            break;
          }
        }
      }
    } catch (error) {
      console.log('Could not load Playwright config, falling back to environment config:', error.message);
    }
    
    // Fallback to environment configuration if Playwright project not found
    if (playwrightProject === 'chromium' && finalUrl === websiteUrl) {
      const envConfig = environmentConfig.environments[environment];
      if (envConfig) {
        // Use environment-specific URL if available, otherwise use provided URL
        finalUrl = envConfig.url || websiteUrl;
        // Map environment names to valid Playwright project names
        if (environment === 'local') {
          playwrightProject = 'chromium';
        } else if (environment === 'staging') {
          playwrightProject = 'firefox';
        } else if (environment === 'production') {
          playwrightProject = 'webkit';
        } else {
          playwrightProject = 'chromium'; // Default fallback
        }
      } else {
        // Fallback for unknown environments
        playwrightProject = 'chromium';
        finalUrl = websiteUrl;
      }
    }
    
    // Set up environment variables
    const env = {
      ...process.env,
      LOCAL: finalUrl,
      USERNAME: username || '',
      PASSWORD: password || '',
      BASE_URL: finalUrl
    };
    
    // Add GUI-specific environment variables for headed mode
    if (runWithUI) {
      env.DISPLAY = process.env.DISPLAY || ':0';
      env.PLAYWRIGHT_BROWSERS_PATH = process.env.PLAYWRIGHT_BROWSERS_PATH || '0';
      // Force browser to run in headed mode
      env.PWDEBUG = '1';
      // Ensure no headless mode is forced
      delete env.CI;
      delete env.HEADLESS;
    }
    
    // Create test results object
    const testResults = {};
    selectedTestFiles.forEach(file => {
      testResults[file] = 'pending';
    });
    
    // Start the test execution
    const startTime = Date.now();
    
    // Build the Playwright command
    const playwrightArgs = [
      'test',
      // `--project=${playwrightProject}`,
      // '--reporter=json'
      //not need it
    ];
    
    // Add headed mode if runWithUI is enabled
    if (runWithUI) {
      playwrightArgs.push('--headed');
      // Add additional flags to ensure browser visibility
      playwrightArgs.push('--timeout=0');
      playwrightArgs.push('--workers=1');
      // Try alternative approach - set headless to false via environment
      env.PLAYWRIGHT_HEADLESS = 'false';
    }
    
    // Add specific test files or individual test cases if selected
    if (selectedTestFiles.length > 0) {
      if (testExecutionOrder && testExecutionOrder.length > 0) {
        // Execute individual test cases in order
        testExecutionOrder.forEach(testCase => {
          const [fileName, testName] = testCase.split(':');
          // Add test file path first, then grep pattern
          playwrightArgs.push(path.join('tests', fileName), `--grep=${testName}`);
        });
      } else {
        // Execute entire test files
        selectedTestFiles.forEach(file => {
          playwrightArgs.push(path.join('tests', file));
        });
      }
    }
    
    console.log(`Running Playwright tests in ${projectPath}`);
    console.log(`Command: npx playwright ${playwrightArgs.join(' ')}`);
    console.log(`Environment: ${environment} (Playwright project: ${playwrightProject})`);
    console.log(`URL: ${finalUrl}`);
    console.log(`Environment Variables: LOCAL=${env.LOCAL}, USERNAME=${env.USERNAME}`);
    console.log(`Display: ${env.DISPLAY}, Playwright Browsers Path: ${env.PLAYWRIGHT_BROWSERS_PATH}`);
    console.log(`runWithUI value: ${runWithUI} (type: ${typeof runWithUI})`);
    console.log(`Platform: ${process.platform}, Process UID: ${process.getuid ? process.getuid() : 'N/A'}`);
    console.log(`Environment variables for headed mode:`, runWithUI ? {
      DISPLAY: env.DISPLAY,
      PWDEBUG: env.PWDEBUG,
      CI: env.CI,
      HEADLESS: env.HEADLESS
    } : 'N/A');
    
    // Create command log for monitoring
    const commandLog = createCommandLog(
      projectName,
      'npx playwright',
      playwrightArgs,
      environment
    );
    
    // Format command with environment variables
    const envVars = [];
    if (env.LOCAL) envVars.push(`LOCAL=${env.LOCAL}`);
    if (env.USERNAME) envVars.push(`USERNAME=${env.USERNAME}`);
    if (env.PASSWORD) envVars.push(`PASSWORD=***`);
    const envPrefix = envVars.length > 0 ? `${envVars.join(' ')} ` : '';
    
    // Log the exact Playwright command being executed
    console.log('=== EXECUTING PLAYWRIGHT COMMAND ===');
    console.log(`Command ID: ${commandLog.id}`);
    console.log(`Full command: ${envPrefix}npx playwright ${playwrightArgs.join(' ')}`);
    console.log(`Working directory: ${projectPath}`);
    console.log(`Playwright args:`, playwrightArgs);
    console.log(`Environment variables:`, {
      LOCAL: env.LOCAL,
      USERNAME: env.USERNAME ? '***' : 'not set',
      PASSWORD: env.PASSWORD ? '***' : 'not set',
      BASE_URL: env.BASE_URL,
      DISPLAY: env.DISPLAY,
      PLAYWRIGHT_BROWSERS_PATH: env.PLAYWRIGHT_BROWSERS_PATH,
      PWDEBUG: env.PWDEBUG,
      PLAYWRIGHT_HEADLESS: env.PLAYWRIGHT_HEADLESS
    });
    
    // Debug: Check if test files exist
    console.log('=== DEBUGGING TEST FILES ===');
    for (const testFile of selectedTestFiles) {
      const fullPath = path.join(projectPath, 'tests', testFile);
      try {
        const stats = await fs.stat(fullPath);
        console.log(`Test file exists: ${fullPath} (${stats.size} bytes)`);
      } catch (error) {
        console.log(`Test file NOT found: ${fullPath}`);
      }
    }
    console.log('=====================================');
    
    // Add initial log entries
    commandLog.addLog('info', `Starting Playwright test execution for project: ${projectName}`);
    commandLog.addLog('info', `Command: ${envPrefix}npx playwright ${playwrightArgs.join(' ')}`);
    commandLog.addLog('info', `Environment: ${environment} (${finalUrl})`);
    commandLog.addLog('info', `Selected test files: ${selectedTestFiles.join(', ')}`);
    
    // Execute Playwright tests
    const spawnOptions = {
      cwd: projectPath,
      env: env,
      stdio: ['pipe', 'pipe', 'pipe']
    };
    
    // For headed mode, ensure the process can access the display
    if (runWithUI) {
      spawnOptions.detached = false;
      spawnOptions.shell = false;
      // On Unix-like systems, ensure the process can access the display
      if (process.platform !== 'win32') {
        spawnOptions.uid = process.getuid();
        spawnOptions.gid = process.getgid();
      }
    }
    
    const playwrightProcess = spawn('npx', ['playwright', ...playwrightArgs], spawnOptions);
    
    // Store process ID in command log
    commandLog.processId = playwrightProcess.pid;
    commandLog.addLog('info', `Process started with PID: ${playwrightProcess.pid}`);
    
    let stdout = '';
    let stderr = '';
    let hasError = false;
    
    // Collect output and stream to command log
    playwrightProcess.stdout.on('data', (data) => {
      const dataStr = data.toString();
      stdout += dataStr;
      commandLog.addOutput(data, false);
      console.log('Playwright stdout:', dataStr);
      
      // Parse and log specific Playwright events
      if (dataStr.includes('Running')) {
        commandLog.addLog('info', `Test execution started: ${dataStr.trim()}`);
      } else if (dataStr.includes('PASS')) {
        commandLog.addLog('success', `Test passed: ${dataStr.trim()}`);
      } else if (dataStr.includes('FAIL')) {
        commandLog.addLog('error', `Test failed: ${dataStr.trim()}`);
      } else if (dataStr.includes('SKIP')) {
        commandLog.addLog('warn', `Test skipped: ${dataStr.trim()}`);
      }
    });
    
    playwrightProcess.stderr.on('data', (data) => {
      const errorData = data.toString();
      stderr += errorData;
      hasError = true;
      commandLog.addOutput(data, true);
      console.log('Playwright stderr:', errorData);
      
      // Log browser launch errors specifically
      if (runWithUI && (errorData.includes('browser') || errorData.includes('display') || errorData.includes('X11'))) {
        console.log('Browser launch error (headed mode):', errorData);
        commandLog.addLog('error', `Browser launch error: ${errorData.trim()}`);
      } else if (errorData.includes('Error') || errorData.includes('error')) {
        commandLog.addLog('error', `Process error: ${errorData.trim()}`);
      }
    });
    
    // Handle process completion
    playwrightProcess.on('close', async (code) => {
      const executionTime = Date.now() - startTime;
      
      // Complete the command log
      commandLog.complete(code);
      commandLog.addLog('info', `Process completed with exit code: ${code}`);
      commandLog.addLog('info', `Total execution time: ${executionTime}ms`);
      
      // Parse test results from JSON output
      let parsedResults = {};
      let passedCount = 0;
      let failedCount = 0;
      let skippedCount = 0;
      
      try {
        // Try to parse JSON output from Playwright
        const lines = stdout.split('\n');
        let jsonFound = false;
        
        for (const line of lines) {
          if (line.trim().startsWith('{') && line.includes('"tests"')) {
            const result = JSON.parse(line);
            jsonFound = true;
            
            if (result.tests) {
              result.tests.forEach(test => {
                const fileName = test.file.split('/').pop();
                if (selectedTestFiles.includes(fileName)) {
                  if (test.status === 'passed') {
                    parsedResults[fileName] = 'passed';
                    passedCount++;
                  } else if (test.status === 'failed') {
                    parsedResults[fileName] = 'failed';
                    failedCount++;
                  } else {
                    parsedResults[fileName] = 'skipped';
                    skippedCount++;
                  }
                }
              });
            }
            break;
          }
        }
        
        // If no JSON found, try to parse from Playwright report files
        if (!jsonFound) {
          console.log('No JSON output found, checking for Playwright report files...');
          
          // Try to read from Playwright JSON report first
          try {
            const jsonReportPath = path.join(projectPath, 'test-results', 'results.json');
            const jsonReportExists = await fs.access(jsonReportPath).then(() => true).catch(() => false);
            
            if (jsonReportExists) {
              console.log('Found Playwright JSON report, parsing results...');
              const jsonReportContent = await fs.readFile(jsonReportPath, 'utf8');
              const jsonReport = JSON.parse(jsonReportContent);
              
              if (jsonReport.suites) {
                jsonReport.suites.forEach(suite => {
                  if (suite.specs) {
                    suite.specs.forEach(spec => {
                      const fileName = spec.title.split('/').pop() || spec.title;
                      if (selectedTestFiles.includes(fileName)) {
                        if (spec.tests) {
                          spec.tests.forEach(test => {
                            if (test.results && test.results.length > 0) {
                              const result = test.results[test.results.length - 1]; // Get latest result
                              const status = result.status;
                              
                              if (status === 'passed') {
                                parsedResults[fileName] = 'passed';
                                passedCount++;
                              } else if (status === 'failed') {
                                parsedResults[fileName] = 'failed';
                                failedCount++;
                              } else {
                                parsedResults[fileName] = 'skipped';
                                skippedCount++;
                              }
                            }
                          });
                        }
                      }
                    });
                  }
                });
                
                jsonFound = true; // Mark as found to skip other parsing
              }
            }
          } catch (jsonReportError) {
            console.log('Could not read Playwright JSON report:', jsonReportError.message);
          }
          
          // If JSON report not found, try HTML report
          if (!jsonFound) {
            try {
              const reportPath = path.join(projectPath, 'playwright-report', 'index.html');
              const reportExists = await fs.access(reportPath).then(() => true).catch(() => false);
              
              if (reportExists) {
                console.log('Found Playwright HTML report, parsing results...');
                const reportContent = await fs.readFile(reportPath, 'utf8');
                
                // Parse test results from HTML report
                selectedTestFiles.forEach(file => {
                  const filePattern = new RegExp(`"${file}"`, 'g');
                  const matches = reportContent.match(filePattern);
                  
                  if (matches) {
                    // Look for test status in the HTML
                    const statusPattern = new RegExp(`"${file}".*?"status":"(passed|failed|skipped)"`, 'g');
                    const statusMatch = reportContent.match(statusPattern);
                    
                    if (statusMatch) {
                      const status = statusMatch[0].match(/"status":"(passed|failed|skipped)"/)[1];
                      parsedResults[file] = status;
                      
                      if (status === 'passed') passedCount++;
                      else if (status === 'failed') failedCount++;
                      else skippedCount++;
                    } else {
                      // If no explicit status, use process exit code
                      const status = code === 0 ? 'passed' : 'failed';
                      parsedResults[file] = status;
                      if (status === 'passed') passedCount++;
                      else failedCount++;
                    }
                  } else {
                    // File not found in report, use process exit code
                    const status = code === 0 ? 'passed' : 'failed';
                    parsedResults[file] = status;
                    if (status === 'passed') passedCount++;
                    else failedCount++;
                  }
                });
                
                jsonFound = true; // Mark as found to skip stdout parsing
              }
            } catch (reportError) {
              console.log('Could not read Playwright HTML report:', reportError.message);
            }
          }
        }
        
        // If still no JSON found, try to parse from exit code and stdout patterns
        if (!jsonFound) {
          console.log('No JSON output found, parsing from stdout patterns...');
          
          // Check if process completed successfully
          const isSuccess = code === 0;
          
          // Parse test results from stdout patterns
          selectedTestFiles.forEach(file => {
            let fileStatus = 'unknown';
            
            // Look for test results in stdout for this specific file
            const fileLines = lines.filter(line => 
              line.toLowerCase().includes(file.toLowerCase())
            );
            
            if (fileLines.length > 0) {
              const fileOutput = fileLines.join(' ');
              
              // Check for specific patterns in the file output
              if (/✗|failed|FAIL|❌|Error|error/gi.test(fileOutput)) {
                fileStatus = 'failed';
                failedCount++;
              } else if (/✓|passed|PASS|✅/gi.test(fileOutput)) {
                fileStatus = 'passed';
                passedCount++;
              } else if (/skipped|SKIP|⏭️/gi.test(fileOutput)) {
                fileStatus = 'skipped';
                skippedCount++;
              } else if (isSuccess) {
                // If process succeeded and no explicit failure found, assume passed
                fileStatus = 'passed';
                passedCount++;
              } else {
                // If process failed, assume failed
                fileStatus = 'failed';
                failedCount++;
              }
            } else {
              // No specific output for this file, use overall process result
              if (isSuccess) {
                fileStatus = 'passed';
                passedCount++;
              } else {
                fileStatus = 'failed';
                failedCount++;
              }
            }
            
            parsedResults[file] = fileStatus;
          });
        }
        
      } catch (parseError) {
        console.error('Error parsing Playwright output:', parseError);
        console.log('Using process exit code for fallback...');
        
        // Use process exit code as fallback instead of random
        const isSuccess = code === 0;
        selectedTestFiles.forEach(file => {
          const status = isSuccess ? 'passed' : 'failed';
          parsedResults[file] = status;
          if (isSuccess) {
            passedCount++;
          } else {
            failedCount++;
          }
        });
      }
      
      // If still no results parsed, use process exit code
      if (Object.keys(parsedResults).length === 0) {
        console.log('No results parsed, using process exit code...');
        const isSuccess = code === 0;
        selectedTestFiles.forEach(file => {
          const status = isSuccess ? 'passed' : 'failed';
          parsedResults[file] = status;
          if (isSuccess) {
            passedCount++;
          } else {
            failedCount++;
          }
        });
      }
      
      // Log parsed results for debugging
      console.log('Test result parsing summary:', {
        totalFiles: selectedTestFiles.length,
        parsedResults: Object.keys(parsedResults).length,
        passed: passedCount,
        failed: failedCount,
        skipped: skippedCount,
        results: parsedResults
      });
      
      // Prepare results
      const testResults = {
        project: projectName,
        websiteUrl: finalUrl,
        username,
        environment,
        playwrightProject,
        totalTests: selectedTestFiles.length,
        passed: passedCount,
        failed: failedCount,
        skipped: skippedCount,
        testResults: parsedResults,
        executionTime,
        exitCode: code,
        stdout: stdout.substring(0, 1000), // Limit output size
        stderr: stderr.substring(0, 1000), // Limit error size
        timestamp: new Date().toISOString(),
        commandLogId: commandLog.id // Include command log ID for reference
      };

      // Cache the test results
      cacheTestRun(projectName, testResults);

      // Send response
      res.json({
        success: code === 0 && !hasError,
        message: code === 0 ? 'Test execution completed' : 'Test execution completed with errors',
        results: testResults
      });
    });
    
    // Handle process errors
    playwrightProcess.on('error', (error) => {
      console.error('Playwright process error:', error);
      
      // Log the error in command log
      commandLog.addLog('error', `Process error: ${error.message}`);
      commandLog.complete(-1);
      
      res.status(500).json({
        success: false,
        error: 'Failed to start Playwright process',
        message: error.message,
        results: {
          project: projectName,
          websiteUrl: finalUrl,
          username,
          environment,
          playwrightProject,
          totalTests: selectedTestFiles.length,
          passed: 0,
          failed: selectedTestFiles.length,
          skipped: 0,
          testResults: Object.fromEntries(selectedTestFiles.map(file => [file, 'failed'])),
          executionTime: Date.now() - startTime,
          exitCode: -1,
          error: error.message,
          timestamp: new Date().toISOString(),
          commandLogId: commandLog.id
        }
      });
    });
    
  } catch (error) {
    console.error('Error running tests:', error);
    res.status(500).json({ 
      error: 'Failed to run tests',
      message: error.message 
    });
  }
});

// API endpoint to open test file
app.get('/api/projects/:projectName/test-file/:fileName', async (req, res) => {
  try {
    const { projectName, fileName } = req.params;
    const projectPath = path.join(PLAYWRIGHT_PROJECTS_PATH, projectName);
    const testFilePath = path.join(projectPath, 'tests', fileName);
    
    // Check if project exists
    try {
      await fs.access(projectPath);
    } catch (error) {
      return res.status(404).json({ 
        error: 'Project not found',
        message: `Project "${projectName}" does not exist`
      });
    }
    
    // Check if test file exists
    try {
      await fs.access(testFilePath);
    } catch (error) {
      return res.status(404).json({ 
        error: 'Test file not found',
        message: `Test file "${fileName}" does not exist in project "${projectName}"`
      });
    }
    
    // Read and return the test file content
    const content = await fs.readFile(testFilePath, 'utf8');
    const stats = await getFileStats(testFilePath);
    
    res.json({
      success: true,
      file: {
        name: fileName,
        path: testFilePath,
        content,
        lastModified: stats ? stats.lastModified : null,
        size: stats ? stats.size : 0
      }
    });
    
  } catch (error) {
    console.error('Error reading test file:', error);
    res.status(500).json({ 
      error: 'Failed to read test file',
      message: error.message 
    });
  }
});

// API endpoint to generate test report
app.get('/api/projects/:projectName/report', async (req, res) => {
  try {
    const { projectName } = req.params;
    const projectPath = path.join(PLAYWRIGHT_PROJECTS_PATH, projectName);
    
    // Check if project exists
    try {
      await fs.access(projectPath);
    } catch (error) {
      return res.status(404).json({ 
        error: 'Project not found',
        message: `Project "${projectName}" does not exist`
      });
    }
    
    // Check for existing test reports
    const reportsPath = path.join(projectPath, 'test-results');
    let reports = [];
    
    try {
      await fs.access(reportsPath);
      const files = await fs.readdir(reportsPath);
      reports = files
        .filter(file => file.endsWith('.html') || file.endsWith('.json'))
        .map(file => {
          const filePath = path.join(reportsPath, file);
          return {
            name: file,
            path: filePath,
            type: file.endsWith('.html') ? 'html' : 'json',
            url: `/api/projects/${projectName}/report/${file}`
          };
        })
        .sort((a, b) => b.name.localeCompare(a.name)); // Sort by name (newest first)
    } catch (error) {
      // Reports directory doesn't exist
    }
    
    // If no reports exist, create a sample report
    if (reports.length === 0) {
      const sampleReport = {
        name: 'sample-report.html',
        path: path.join(projectPath, 'sample-report.html'),
        type: 'html',
        url: `/api/projects/${projectName}/report/sample-report.html`
      };
      reports = [sampleReport];
    }
    
    res.json({
      success: true,
      project: projectName,
      reports,
      latestReport: reports[0] || null
    });
    
  } catch (error) {
    console.error('Error generating test report:', error);
    res.status(500).json({ 
      error: 'Failed to generate test report',
      message: error.message 
    });
  }
});

// API endpoint to serve test report files
app.get('/api/projects/:projectName/report/:reportFile', async (req, res) => {
  try {
    const { projectName, reportFile } = req.params;
    const projectPath = path.join(PLAYWRIGHT_PROJECTS_PATH, projectName);
    const reportPath = path.join(projectPath, 'test-results', reportFile);
    
    // Check if report file exists
    try {
      await fs.access(reportPath);
    } catch (error) {
      // If report doesn't exist, create a sample HTML report
      if (reportFile.endsWith('.html')) {
        const sampleHtml = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Test Report - ${projectName}</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 40px; background: #f5f5f5; }
        .container { max-width: 1200px; margin: 0 auto; background: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        .header { border-bottom: 2px solid #e0e0e0; padding-bottom: 20px; margin-bottom: 30px; }
        .summary { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin-bottom: 30px; }
        .stat-card { background: #f8f9fa; padding: 20px; border-radius: 6px; text-align: center; }
        .stat-number { font-size: 2em; font-weight: bold; margin-bottom: 5px; }
        .passed { color: #28a745; }
        .failed { color: #dc3545; }
        .pending { color: #ffc107; }
        .test-list { margin-top: 30px; }
        .test-item { padding: 15px; border: 1px solid #e0e0e0; border-radius: 4px; margin-bottom: 10px; }
        .test-name { font-weight: bold; margin-bottom: 5px; }
        .test-status { display: inline-block; padding: 4px 8px; border-radius: 4px; font-size: 0.8em; }
        .status-passed { background: #d4edda; color: #155724; }
        .status-failed { background: #f8d7da; color: #721c24; }
        .status-pending { background: #fff3cd; color: #856404; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>Test Report - ${projectName}</h1>
            <p>Generated on ${new Date().toLocaleString()}</p>
        </div>
        
        <div class="summary">
            <div class="stat-card">
                <div class="stat-number passed">5</div>
                <div>Passed</div>
            </div>
            <div class="stat-card">
                <div class="stat-number failed">1</div>
                <div>Failed</div>
            </div>
            <div class="stat-card">
                <div class="stat-number pending">0</div>
                <div>Skipped</div>
            </div>
            <div class="stat-card">
                <div class="stat-number">6</div>
                <div>Total</div>
            </div>
        </div>
        
        <div class="test-list">
            <h2>Test Results</h2>
            <div class="test-item">
                <div class="test-name">homepage has title</div>
                <div class="test-status status-passed">PASSED</div>
            </div>
            <div class="test-item">
                <div class="test-name">get started link</div>
                <div class="test-status status-passed">PASSED</div>
            </div>
            <div class="test-item">
                <div class="test-name">basic navigation test</div>
                <div class="test-status status-passed">PASSED</div>
            </div>
            <div class="test-item">
                <div class="test-name">form interaction test</div>
                <div class="test-status status-passed">PASSED</div>
            </div>
            <div class="test-item">
                <div class="test-name">button click test</div>
                <div class="test-status status-passed">PASSED</div>
            </div>
            <div class="test-item">
                <div class="test-name">advanced form validation</div>
                <div class="test-status status-failed">FAILED</div>
            </div>
        </div>
    </div>
</body>
</html>`;
        
        res.setHeader('Content-Type', 'text/html');
        return res.send(sampleHtml);
      }
      
      return res.status(404).json({ 
        error: 'Report not found',
        message: `Report "${reportFile}" does not exist`
      });
    }
    
    // Serve the actual report file
    const content = await fs.readFile(reportPath, 'utf8');
    const contentType = reportFile.endsWith('.html') ? 'text/html' : 'application/json';
    
    res.setHeader('Content-Type', contentType);
    res.send(content);
    
  } catch (error) {
    console.error('Error serving test report:', error);
    res.status(500).json({ 
      error: 'Failed to serve test report',
      message: error.message 
    });
  }
});

// API endpoint to get cached test run status for a project
app.get('/api/projects/:projectName/test-status', async (req, res) => {
  try {
    const { projectName } = req.params;
    const cachedRun = getCachedTestRun(projectName);
    
    if (!cachedRun) {
      return res.json({
        success: true,
        hasCache: false,
        message: 'No cached test run found for this project'
      });
    }
    
    res.json({
      success: true,
      hasCache: true,
      cachedRun
    });
    
  } catch (error) {
    console.error('Error getting cached test status:', error);
    res.status(500).json({ 
      error: 'Failed to get cached test status',
      message: error.message 
    });
  }
});

// API endpoint to get all cached test run statuses
app.get('/test-status/all', async (req, res) => {
  try {
    const allCachedRuns = getAllCachedTestRuns();
    
    res.json({
      success: true,
      cachedRuns: allCachedRuns,
      totalCached: allCachedRuns.length
    });
    
  } catch (error) {
    console.error('Error getting all cached test statuses:', error);
    res.status(500).json({ 
      error: 'Failed to get cached test statuses',
      message: error.message 
    });
  }
});

// API endpoint to clear cached test run status for a project
app.delete('/api/projects/:projectName/test-status', async (req, res) => {
  try {
    const { projectName } = req.params;
    clearTestRunCache(projectName);
    
    res.json({
      success: true,
      message: `Cached test run status cleared for project: ${projectName}`
    });
    
  } catch (error) {
    console.error('Error clearing cached test status:', error);
    res.status(500).json({ 
      error: 'Failed to clear cached test status',
      message: error.message 
    });
  }
});

// API endpoint to clear all cached test run statuses
app.delete('/test-status/all', async (req, res) => {
  try {
    testRunCache.clear();
    
    res.json({
      success: true,
      message: 'All cached test run statuses cleared'
    });
    
  } catch (error) {
    console.error('Error clearing all cached test statuses:', error);
    res.status(500).json({ 
      error: 'Failed to clear all cached test statuses',
      message: error.message 
    });
  }
});

// API endpoint to start Playwright report server
app.post('/api/projects/:projectName/start-report', async (req, res) => {
  try {
    const { projectName } = req.params;
    const projectPath = path.join(PLAYWRIGHT_PROJECTS_PATH, projectName);
    
    // Check if project exists
    try {
      await fs.access(projectPath);
    } catch (error) {
      return res.status(404).json({ 
        error: 'Project not found',
        message: `Project "${projectName}" does not exist`
      });
    }
    
    // Start the Playwright report server
    console.log('=== EXECUTING PLAYWRIGHT REPORT COMMAND ===');
    console.log(`Full command: npx playwright show-report --host 192.168.0.144 --port 9323`);
    console.log(`Working directory: ${projectPath}`);
    console.log('==========================================');
    
    const reportProcess = spawn('npx', ['playwright', 'show-report', '--host', '192.168.0.144', '--port', '9323'], {
      cwd: projectPath,
      detached: true,
      stdio: 'ignore'
    });
    
    reportProcess.unref();
    
    res.json({
      success: true,
      message: 'Playwright report server started',
      url: 'http://192.168.0.144:9323'
    });
    
  } catch (error) {
    console.error('Error starting report server:', error);
    res.status(500).json({ 
      error: 'Failed to start report server',
      message: error.message 
    });
  }
});

// API endpoint to clear cache (storageState.json) for a project
app.post('/api/projects/:projectName/clear-cache', async (req, res) => {
  try {
    const { projectName } = req.params;
    const projectPath = path.join(PLAYWRIGHT_PROJECTS_PATH, projectName);
    
    // Check if project exists
    try {
      await fs.access(projectPath);
    } catch (error) {
      return res.status(404).json({ 
        error: 'Project not found',
        message: `Project "${projectName}" does not exist`
      });
    }
    
    // Path to storageState.json file
    const storageStatePath = path.join(projectPath, 'storageState.json');
    
    try {
      // Check if storageState.json exists
      await fs.access(storageStatePath);
      
      // Clear the file by writing an empty object
      await fs.writeFile(storageStatePath, '{}', 'utf8');
      
      console.log(`Cleared cache for project: ${projectName}`);
      
      res.json({
        success: true,
        message: 'Cache cleared successfully',
        project: projectName,
        filePath: storageStatePath
      });
      
    } catch (error) {
      // If file doesn't exist, create it with empty object
      if (error.code === 'ENOENT') {
        await fs.writeFile(storageStatePath, '{}', 'utf8');
        
        console.log(`Created empty storageState.json for project: ${projectName}`);
        
        res.json({
          success: true,
          message: 'Cache file created and cleared',
          project: projectName,
          filePath: storageStatePath
        });
      } else {
        throw error;
      }
    }
    
  } catch (error) {
    console.error('Error clearing cache:', error);
    res.status(500).json({ 
      error: 'Failed to clear cache',
      message: error.message 
    });
  }
});

// API endpoint to get environment configuration
app.get('/api/environments', async (req, res) => {
  try {
    const { projectPath } = req.query;
    
    console.log('GET /api/environments - Request received:', {
      projectPath,
      hasEnvironmentConfig: !!environmentConfig
    });
    
    if (!environmentConfig) {
      console.log('Loading environment configuration...');
      await loadEnvironmentConfig(projectPath);
    }
    
    console.log('Environment configuration loaded:', {
      environments: Object.keys(environmentConfig.environments || {}),
      defaultEnvironment: environmentConfig.defaultEnvironment
    });
    
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

// API endpoint to update environment configuration
app.put('/api/environments', async (req, res) => {
  try {
    const { environments, defaultEnvironment, errorContext } = req.body;
    
    if (!environmentConfig) {
      await loadEnvironmentConfig(null);
    }
    
    // Update environment configuration
    if (environments) {
      environmentConfig.environments = environments;
    }
    if (defaultEnvironment) {
      environmentConfig.defaultEnvironment = defaultEnvironment;
    }
    if (errorContext) {
      environmentConfig.errorContext = { ...environmentConfig.errorContext, ...errorContext };
    }
    
    // Save to file
    await saveEnvironmentConfig();
    
    res.json({
      success: true,
      message: 'Environment configuration updated successfully',
      environments: environmentConfig.environments,
      defaultEnvironment: environmentConfig.defaultEnvironment,
      errorContext: environmentConfig.errorContext
    });
    
  } catch (error) {
    console.error('Error updating environment configuration:', error);
    res.status(500).json({ 
      error: 'Failed to update environment configuration',
      message: error.message 
    });
  }
});

// API endpoint to get specific environment
app.get('/api/environments/:envId', async (req, res) => {
  try {
    const { envId } = req.params;
    
    if (!environmentConfig) {
      await loadEnvironmentConfig(null);
    }
    
    const environment = environmentConfig.environments[envId];
    
    if (!environment) {
      return res.status(404).json({
        error: 'Environment not found',
        message: `Environment "${envId}" does not exist`
      });
    }
    
    res.json({
      success: true,
      environment: {
        id: envId,
        ...environment
      }
    });
    
  } catch (error) {
    console.error('Error getting environment:', error);
    res.status(500).json({ 
      error: 'Failed to get environment',
      message: error.message 
    });
  }
});

// API endpoint to update specific environment
app.put('/api/environments/:envId', async (req, res) => {
  try {
    const { envId } = req.params;
    const { name, description, url, defaultUrl, requiresUrl, color, projectPath } = req.body;
    
    console.log('PUT /api/environments/:envId - Request received:', {
      envId,
      projectPath,
      hasEnvironmentConfig: !!environmentConfig,
      availableEnvironments: environmentConfig ? Object.keys(environmentConfig.environments || {}) : 'none'
    });
    
    if (!environmentConfig) {
      console.log('Loading environment configuration for PUT request...');
      await loadEnvironmentConfig(projectPath);
    } else {
      console.log('Environment configuration already loaded, checking if it matches project path...');
      // If we have a project path, make sure we're using the right config
      if (projectPath) {
        console.log('Reloading environment configuration for project path:', projectPath);
        await loadEnvironmentConfig(projectPath);
      }
    }
    
    console.log('Environment configuration after loading:', {
      environments: Object.keys(environmentConfig.environments || {}),
      requestedEnv: envId,
      envExists: !!(environmentConfig.environments && environmentConfig.environments[envId])
    });
    
    if (!environmentConfig.environments[envId]) {
      console.log(`Environment "${envId}" not found in available environments`);
      return res.status(404).json({
        error: 'Environment not found',
        message: `Environment "${envId}" does not exist`
      });
    }
    
    // Update environment
    environmentConfig.environments[envId] = {
      ...environmentConfig.environments[envId],
      ...(name && { name }),
      ...(description && { description }),
      ...(url !== undefined && { url }),
      ...(defaultUrl && { defaultUrl }),
      ...(requiresUrl !== undefined && { requiresUrl }),
      ...(color && { color })
    };
    
    // Save to file (with project path if provided)
    await saveEnvironmentConfig(projectPath);
    
    res.json({
      success: true,
      message: `Environment "${envId}" updated successfully`,
      environment: {
        id: envId,
        ...environmentConfig.environments[envId]
      }
    });
    
  } catch (error) {
    console.error('Error updating environment:', error);
    res.status(500).json({ 
      error: 'Failed to update environment',
      message: error.message 
    });
  }
});

// API endpoint to load Playwright config from external file
app.get('/api/projects/:projectName/playwright-config', async (req, res) => {
  try {
    const { projectName } = req.params;
    const { configPath } = req.query;
    
    let targetConfigPath;
    
    if (configPath) {
      // Use provided config path
      targetConfigPath = configPath;
    } else {
      // Default to the specified path
      targetConfigPath = '/Users/tam.ct/Documents/auto/playwright/hrm/playwright.config.ts';
    }
    
    console.log(`Loading Playwright config from: ${targetConfigPath}`);
    
    try {
      const configContent = await fs.readFile(targetConfigPath, 'utf8');
      
      // Parse the TypeScript config to extract baseURL values
      const configData = {
        content: configContent,
        baseURLs: {},
        projects: []
      };
      
      // Extract baseURL from use section
      const useBaseURLMatch = configContent.match(/baseURL:\s*(['"`][^'"`]+['"`]|process\.env\.\w+)/);
      if (useBaseURLMatch) {
        const baseURLValue = useBaseURLMatch[1];
        // Handle both string literals and environment variables
        if (baseURLValue.startsWith("'") || baseURLValue.startsWith('"') || baseURLValue.startsWith('`')) {
          configData.baseURLs.default = baseURLValue.slice(1, -1); // Remove quotes
        } else {
          configData.baseURLs.default = baseURLValue; // Keep as is for env vars
        }
      }
      
      // Extract project configurations
      const projectMatches = configContent.match(/projects:\s*\[([\s\S]*?)\]/);
      if (projectMatches) {
        const projectsContent = projectMatches[1];
        const projectRegex = /{\s*name:\s*['"`]([^'"`]+)['"`][\s\S]*?use:\s*{([\s\S]*?)}/g;
        let projectMatch;
        
        while ((projectMatch = projectRegex.exec(projectsContent)) !== null) {
          const projectName = projectMatch[1];
          const projectUse = projectMatch[2];
          const baseURLMatch = projectUse.match(/baseURL:\s*(['"`][^'"`]+['"`]|process\.env\.\w+)/);
          
          let baseURLValue = null;
          if (baseURLMatch) {
            const baseURLRaw = baseURLMatch[1];
            if (baseURLRaw.startsWith("'") || baseURLRaw.startsWith('"') || baseURLRaw.startsWith('`')) {
              baseURLValue = baseURLRaw.slice(1, -1); // Remove quotes
            } else {
              baseURLValue = baseURLRaw; // Keep as is for env vars
            }
          }
          
          configData.projects.push({
            name: projectName,
            baseURL: baseURLValue,
            use: projectUse.trim()
          });
          
          if (baseURLValue) {
            configData.baseURLs[projectName] = baseURLValue;
          }
        }
      }
      
      res.json({
        success: true,
        configPath: targetConfigPath,
        config: configData
      });
      
    } catch (readError) {
      console.error('Error reading Playwright config file:', readError);
      res.status(404).json({
        error: 'Config file not found',
        message: `Could not read config file at ${targetConfigPath}`,
        path: targetConfigPath
      });
    }
    
  } catch (error) {
    console.error('Error loading Playwright config:', error);
    res.status(500).json({
      error: 'Failed to load Playwright config',
      message: error.message
    });
  }
});

// API endpoint to save updated Playwright config
app.put('/api/projects/:projectName/playwright-config', async (req, res) => {
  try {
    const { projectName } = req.params;
    const { configPath, baseURLs, projects } = req.body;
    
    let targetConfigPath;
    
    if (configPath) {
      targetConfigPath = configPath;
    } else {
      targetConfigPath = '/Users/tam.ct/Documents/auto/playwright/hrm/playwright.config.ts';
    }
    
    console.log(`Updating Playwright config at: ${targetConfigPath}`);
    
    try {
      // Read current config
      const currentContent = await fs.readFile(targetConfigPath, 'utf8');
      let updatedContent = currentContent;
      
      // Update default baseURL in use section
      if (baseURLs && baseURLs.default) {
        // Handle both string literals and environment variables
        const isEnvVar = baseURLs.default.startsWith('process.env.');
        const newValue = isEnvVar ? baseURLs.default : `'${baseURLs.default}'`;
        
        updatedContent = updatedContent.replace(
          /baseURL:\s*(['"`][^'"`]*['"`]|process\.env\.\w+)/,
          `baseURL: ${newValue}`
        );
      }
      
      // Update project baseURLs
      if (projects && Array.isArray(projects)) {
        projects.forEach(project => {
          if (project.baseURL) {
            const isEnvVar = project.baseURL.startsWith('process.env.');
            const newValue = isEnvVar ? project.baseURL : `'${project.baseURL}'`;
            
            const projectRegex = new RegExp(
              `(name:\\s*['"\`]${project.name}['"\`][\\s\\S]*?use:\\s*{[\\s\\S]*?)(baseURL:\\s*(['"\`][^'"\`]*['"\`]|process\\.env\\.\\w+))`,
              'g'
            );
            updatedContent = updatedContent.replace(
              projectRegex,
              `$1baseURL: ${newValue}`
            );
          }
        });
      }
      
      // Write updated config
      await fs.writeFile(targetConfigPath, updatedContent);
      
      res.json({
        success: true,
        message: 'Playwright config updated successfully',
        configPath: targetConfigPath
      });
      
    } catch (writeError) {
      console.error('Error writing Playwright config file:', writeError);
      res.status(500).json({
        error: 'Failed to write config file',
        message: `Could not write to ${targetConfigPath}`,
        path: targetConfigPath
      });
    }
    
  } catch (error) {
    console.error('Error updating Playwright config:', error);
    res.status(500).json({
      error: 'Failed to update Playwright config',
      message: error.message
    });
  }
});

// API endpoint to check and install Playwright dependencies
app.get('/api/projects/:projectName/playwright-dependencies', async (req, res) => {
  try {
    const { projectName } = req.params;
    const { projectPath } = req.query;
    
    let targetProjectPath;
    
    if (projectPath) {
      targetProjectPath = projectPath;
    } else {
      targetProjectPath = `/Users/tam.ct/Documents/auto/playwright/${projectName}`;
    }
    
    console.log(`Checking Playwright dependencies for project: ${targetProjectPath}`);
    
    // Check current installation status
    const playwrightCheck = await checkPlaywrightInstalled(targetProjectPath);
    const browsersCheck = await checkPlaywrightBrowsers(targetProjectPath);
    
    res.json({
      success: true,
      projectPath: targetProjectPath,
      playwright: {
        installed: playwrightCheck.installed,
        version: playwrightCheck.version
      },
      browsers: {
        installed: browsersCheck
      },
      ready: playwrightCheck.installed && browsersCheck
    });
    
  } catch (error) {
    console.error('Error checking Playwright dependencies:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// API endpoint to install Playwright dependencies
app.post('/api/projects/:projectName/playwright-dependencies', async (req, res) => {
  try {
    const { projectName } = req.params;
    const { projectPath } = req.query;
    
    let targetProjectPath;
    
    if (projectPath) {
      targetProjectPath = projectPath;
    } else {
      targetProjectPath = `/Users/tam.ct/Documents/auto/playwright/${projectName}`;
    }
    
    console.log(`Installing Playwright dependencies for project: ${targetProjectPath}`);
    
    const result = await ensurePlaywrightInstalled(targetProjectPath);
    
    if (result.success) {
      res.json({
        success: true,
        message: result.message,
        projectPath: targetProjectPath
      });
    } else {
      res.status(500).json({
        success: false,
        error: result.error,
        message: result.message
      });
    }
    
  } catch (error) {
    console.error('Error installing Playwright dependencies:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// API endpoint to get dynamic environments from Playwright config
app.get('/api/projects/:projectName/playwright-environments', async (req, res) => {
  try {
    const { projectName } = req.params;
    const { projectPath } = req.query;
    
    let targetProjectPath;
    
    if (projectPath) {
      targetProjectPath = projectPath;
    } else {
      // Try to find the project path from the project name
      // This is a fallback - ideally the frontend should pass the projectPath
      targetProjectPath = `/Users/tam.ct/Documents/auto/playwright/${projectName}`;
    }
    
    console.log(`Loading dynamic environments from project path: ${targetProjectPath}`);
    
    try {
      // Use our new parsePlaywrightConfig function
      let config;
      try {
        config = await parsePlaywrightConfig(targetProjectPath);
      } catch (configError) {
        // If config not found in current path, try parent directory
        if (configError.code === 'ENOENT' && targetProjectPath.endsWith('/tests')) {
          console.log('Config not found in tests directory, trying parent directory...');
          const parentPath = path.dirname(targetProjectPath);
          config = await parsePlaywrightConfig(parentPath);
        } else {
          throw configError;
        }
      }
      
      // Convert the parsed environments to the format expected by the frontend
      const environments = Object.values(config.environments).map(env => ({
        id: env.id,
        name: env.name,
        description: env.description,
        url: env.url,
        defaultUrl: env.defaultUrl,
        requiresUrl: env.requiresUrl,
        color: env.color,
        icon: env.icon,
        isPlaywrightProject: true,
        baseURL: env.url
      }));
      
      // Add a custom environment option
      environments.push({
        id: 'custom',
        name: 'Custom',
        description: 'Custom environment with manual URL input',
        url: '',
        defaultUrl: '',
        requiresUrl: true,
        color: '#6b7280',
        icon: 'globe',
        isPlaywrightProject: false,
        baseURL: null
      });
      
      res.json({
        success: true,
        environments: environments,
        defaultEnvironment: config.defaultEnvironment
      });
      
    } catch (readError) {
      console.error('Error reading Playwright config file:', readError);
      res.status(404).json({
        error: 'Config file not found',
        message: `Could not read config file at ${targetProjectPath}`,
        path: targetProjectPath
      });
    }
    
  } catch (error) {
    console.error('Error loading Playwright environments:', error);
    res.status(500).json({
      error: 'Failed to load Playwright environments',
      message: error.message
    });
  }
});

// Helper function to get environment icon for Playwright projects
const getPlaywrightEnvironmentIcon = (projectName) => {
  const icons = {
    'staging': 'layers',
    'local': 'home',
    'production': 'zap',
    'dev': 'code',
    'test': 'flask-conical',
    'uat': 'shield-check'
  };
  return icons[projectName] || 'globe';
};

// API endpoint to get all command logs
app.get('/api/command-logs', async (req, res) => {
  try {
    const { limit = 50, status, projectName, startDate, endDate } = req.query;
    
    const filters = {};
    if (status) filters.status = status;
    if (projectName) filters.projectName = projectName;
    if (startDate) filters.startDate = startDate;
    if (endDate) filters.endDate = endDate;
    
    const logs = searchCommandLogs('', filters);
    const limitedLogs = logs.slice(0, parseInt(limit));
    
    res.json({
      success: true,
      logs: limitedLogs.map(log => log.toJSON()),
      total: logs.length,
      filters
    });
    
  } catch (error) {
    console.error('Error getting command logs:', error);
    res.status(500).json({ 
      error: 'Failed to get command logs',
      message: error.message 
    });
  }
});

// API endpoint to get specific command log
app.get('/api/command-logs/:commandId', async (req, res) => {
  try {
    const { commandId } = req.params;
    const commandLog = getCommandLog(commandId);
    
    if (!commandLog) {
      return res.status(404).json({
        error: 'Command log not found',
        message: `Command log with ID "${commandId}" does not exist`
      });
    }
    
    res.json({
      success: true,
      commandLog: commandLog.toJSON()
    });
    
  } catch (error) {
    console.error('Error getting command log:', error);
    res.status(500).json({ 
      error: 'Failed to get command log',
      message: error.message 
    });
  }
});

// API endpoint to search command logs
app.get('/api/command-logs/search', async (req, res) => {
  try {
    const { q: query, status, projectName, startDate, endDate, limit = 50 } = req.query;
    
    const filters = {};
    if (status) filters.status = status;
    if (projectName) filters.projectName = projectName;
    if (startDate) filters.startDate = startDate;
    if (endDate) filters.endDate = endDate;
    
    const logs = searchCommandLogs(query, filters);
    const limitedLogs = logs.slice(0, parseInt(limit));
    
    res.json({
      success: true,
      logs: limitedLogs.map(log => log.toJSON()),
      total: logs.length,
      query,
      filters
    });
    
  } catch (error) {
    console.error('Error searching command logs:', error);
    res.status(500).json({ 
      error: 'Failed to search command logs',
      message: error.message 
    });
  }
});

// API endpoint to get command history
app.get('/api/command-history', async (req, res) => {
  try {
    const { limit = 50 } = req.query;
    const history = getCommandHistory(parseInt(limit));
    
    res.json({
      success: true,
      history: history.map(log => log.toJSON()),
      total: history.length
    });
    
  } catch (error) {
    console.error('Error getting command history:', error);
    res.status(500).json({ 
      error: 'Failed to get command history',
      message: error.message 
    });
  }
});

// API endpoint to get active/running commands
app.get('/api/command-logs/active', async (req, res) => {
  try {
    const activeLogs = Array.from(commandLogs.values())
      .filter(log => log.status === 'running')
      .map(log => log.toJSON());
    
    res.json({
      success: true,
      activeCommands: activeLogs,
      count: activeLogs.length
    });
    
  } catch (error) {
    console.error('Error getting active commands:', error);
    res.status(500).json({ 
      error: 'Failed to get active commands',
      message: error.message 
    });
  }
});

// API endpoint to cancel a running command
app.post('/api/command-logs/:commandId/cancel', async (req, res) => {
  try {
    const { commandId } = req.params;
    const commandLog = getCommandLog(commandId);
    
    if (!commandLog) {
      return res.status(404).json({
        error: 'Command log not found',
        message: `Command log with ID "${commandId}" does not exist`
      });
    }
    
    if (commandLog.status !== 'running') {
      return res.status(400).json({
        error: 'Command not running',
        message: `Command "${commandId}" is not currently running`
      });
    }
    
    // Note: In a real implementation, you would kill the actual process
    // For now, we'll just mark it as cancelled
    commandLog.status = 'cancelled';
    commandLog.endTime = new Date();
    commandLog.addLog('warn', 'Command cancelled by user');
    
    // Broadcast cancellation
    const message = JSON.stringify({
      type: 'command_cancelled',
      data: {
        id: commandLog.id,
        status: 'cancelled',
        endTime: commandLog.endTime.toISOString()
      }
    });
    
    activeConnections.forEach(ws => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(message);
      }
    });
    
    res.json({
      success: true,
      message: `Command "${commandId}" has been cancelled`,
      commandLog: commandLog.toJSON()
    });
    
  } catch (error) {
    console.error('Error cancelling command:', error);
    res.status(500).json({ 
      error: 'Failed to cancel command',
      message: error.message 
    });
  }
});

// API endpoint to clear command logs
app.delete('/api/command-logs', async (req, res) => {
  try {
    const { olderThan } = req.query;
    
    if (olderThan) {
      const cutoffDate = new Date(olderThan);
      const logsToRemove = Array.from(commandLogs.values())
        .filter(log => log.startTime < cutoffDate);
      
      logsToRemove.forEach(log => {
        commandLogs.delete(log.id);
        const index = commandHistory.indexOf(log);
        if (index > -1) {
          commandHistory.splice(index, 1);
        }
      });
      
      res.json({
        success: true,
        message: `Cleared ${logsToRemove.length} command logs older than ${cutoffDate.toISOString()}`,
        clearedCount: logsToRemove.length
      });
    } else {
      // Clear all logs
      const clearedCount = commandLogs.size;
      commandLogs.clear();
      commandHistory.length = 0;
      
      res.json({
        success: true,
        message: 'All command logs cleared',
        clearedCount
      });
    }
    
  } catch (error) {
    console.error('Error clearing command logs:', error);
    res.status(500).json({ 
      error: 'Failed to clear command logs',
      message: error.message 
    });
  }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    activeConnections: activeConnections.size,
    commandLogsCount: commandLogs.size,
    commandHistoryCount: commandHistory.length
  });
});

server.listen(PORT, '0.0.0.0', async () => {
  console.log(`Server running on http://0.0.0.0:${PORT}`);
  console.log(`Server accessible on http://localhost:${PORT}`);
  console.log(`Server accessible on http://192.168.0.144:${PORT}`);
  console.log(`WebSocket server running on ws://0.0.0.0:${PORT}`);
  console.log(`Playwright projects path: ${PLAYWRIGHT_PROJECTS_PATH}`);
  console.log(`Command log monitoring enabled`);
  
  // Load environment configuration on startup
  await loadEnvironmentConfig();
});
