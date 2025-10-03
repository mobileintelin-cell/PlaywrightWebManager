# Playwright Web Manager Dashboard Setup

This dashboard allows you to view and manage your Playwright test projects from your Ubuntu server.

## Prerequisites

- Node.js installed on your Ubuntu server
- Playwright projects located in `~/Documents/auto/playwright/`

## Installation

1. Install dependencies:
```bash
npm install
```

2. Make sure your Playwright projects are in the correct directory:
```bash
ls ~/Documents/auto/playwright/
```

## Running the Application

### Option 1: Development Mode (Recommended)

1. Start the backend server:
```bash
npm run server
```

2. In a new terminal, start the frontend:
```bash
npm run dev
```

3. Open your browser and go to `http://localhost:5173`

### Option 2: Production Mode

1. Build the frontend:
```bash
npm run build
```

2. Start the server:
```bash
npm run server
```

3. The server will serve the built frontend at `http://localhost:3001`

## Project Structure

Your Playwright projects should be organized like this:
```
~/Documents/auto/playwright/
├── project-1/
│   ├── tests/
│   │   ├── example.spec.js
│   │   └── another.spec.ts
│   ├── package.json
│   └── README.md
├── project-2/
│   ├── tests/
│   │   └── test.spec.js
│   └── playwright.config.js
└── project-3/
    └── tests/
        └── e2e.spec.js
```

## Features

- **Real-time Project Discovery**: Automatically scans your `~/Documents/auto/playwright/` directory
- **Test Count**: Counts `.spec.js`, `.spec.ts`, `.test.js`, and `.test.ts` files
- **Project Descriptions**: Reads from README.md or package.json
- **Search Functionality**: Search projects by name or description
- **Status Indicators**: Shows project activity based on last modification
- **Project Creation**: Create new Playwright projects with sample tests and configuration
- **Offline Mode**: Falls back to sample data if server is unavailable

## API Endpoints

- `GET /api/projects` - Get all projects
- `GET /api/projects/search?q=query` - Search projects
- `POST /api/projects/create` - Create a new project
- `GET /api/health` - Health check

## Troubleshooting

### Server Connection Issues

If you see "Using offline mode" in the header:

1. Make sure the server is running: `npm run server`
2. Check if port 3001 is available
3. Verify the projects directory exists: `ls ~/Documents/auto/playwright/`

### No Projects Found

1. Ensure your projects are in `~/Documents/auto/playwright/`
2. Check that the directory contains subdirectories (not just files)
3. Verify you have read permissions on the directory
4. **Create a new project**: Use the "Create Test Project" button to generate a sample Playwright project with tests and configuration

## Creating New Projects

When no projects are found, you can create a new Playwright project directly from the dashboard:

1. Click the **"Create Test Project"** button
2. Enter a project name (will be converted to lowercase with hyphens)
3. Optionally add a description
4. Click **"Create Project"**

The system will automatically create:
- Project directory structure
- `package.json` with Playwright dependencies and scripts
- `playwright.config.js` with standard configuration
- Sample test file (`tests/example.spec.js`)
- `README.md` with setup instructions

### Permission Issues

If you get permission errors:
```bash
chmod -R 755 ~/Documents/auto/playwright/
```

## Customization

To change the projects directory, edit `server.js` and modify:
```javascript
const PLAYWRIGHT_PROJECTS_PATH = path.join(process.env.HOME || '/home', 'Documents/auto/playwright');
```

## Security Note

This setup is designed for local development. For production use, consider:
- Adding authentication
- Using environment variables for configuration
- Implementing proper error handling and logging
- Adding rate limiting and input validation
