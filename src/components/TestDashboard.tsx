import { useState, useEffect } from 'react';
import { Button } from "./ui/button";
import { StatusPill } from "./StatusPill";
import { RunTestsCard, TestRunConfig } from "./RunTestsCard";
import { QuickActionsCard } from "./QuickActionsCard";
import { LiveLogsCard } from "./LiveLogsCard";
import { ExternalLink, FileText, Folder, ArrowLeft, RefreshCw, AlertCircle, Trash2, Download, Database, Clock } from "lucide-react";

interface TestDashboardProps {
  selectedProject: string;
  onBackToProjectSelection: () => void;
}

interface TestCase {
  fileName: string;
  filePath: string;
  testCount: number;
  testNames: string[];
  lastModified: string | null;
  size: number;
  error?: string;
}

interface TestData {
  project: string;
  tests: TestCase[];
  totalTests: number;
}

export function TestDashboard({ selectedProject, onBackToProjectSelection }: TestDashboardProps) {
  const [status, setStatus] = useState<'idle' | 'running'>('idle');
  const [logs, setLogs] = useState<string[]>([]);
  const [testResults, setTestResults] = useState<Record<string, 'passed' | 'failed' | 'pending'>>({});
  const [testData, setTestData] = useState<TestData | null>(null);
  const [isLoadingTests, setIsLoadingTests] = useState(false);
  const [testError, setTestError] = useState<string | null>(null);
  const [cachedTestStatus, setCachedTestStatus] = useState<any>(null);
  const [isLoadingCache, setIsLoadingCache] = useState(false);

  // Fetch test data from API
  const fetchTestData = async () => {
    setIsLoadingTests(true);
    setTestError(null);
    try {
      const response = await fetch(`http://localhost:3001/api/projects/${selectedProject}/tests`);
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      setTestData(data);
      addLog(`Loaded ${data.totalTests} test cases from ${data.tests.length} files`);
    } catch (error) {
      console.error('Error fetching test data:', error);
      setTestError(error instanceof Error ? error.message : 'Failed to fetch test data');
      addLog(`Error loading test data: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsLoadingTests(false);
    }
  };

  // Get test files for the current project
  const testFiles = testData?.tests.map(test => test.fileName) || [];

  const addLog = (message: string) => {
    setLogs(prev => [...prev, message]);
  };

  // Fetch cached test status
  const fetchCachedTestStatus = async () => {
    setIsLoadingCache(true);
    try {
      const response = await fetch(`http://localhost:3001/api/projects/${selectedProject}/test-status`);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      setCachedTestStatus(data.hasCache ? data.cachedRun : null);
      
      if (data.hasCache) {
        addLog(`Loaded cached test status from ${new Date(data.cachedRun.cachedAt).toLocaleString()}`);
        // Update test results from cache
        setTestResults(data.cachedRun.testResults || {});
      }
    } catch (error) {
      console.error('Error fetching cached test status:', error);
      setCachedTestStatus(null);
    } finally {
      setIsLoadingCache(false);
    }
  };

  // Fetch test data when component mounts or project changes
  useEffect(() => {
    fetchTestData();
    fetchCachedTestStatus();
  }, [selectedProject]);

  const runTests = async (config: TestRunConfig) => {
    setStatus('running');
    
    // Reset test results for selected files
    const initialResults: Record<string, 'passed' | 'failed' | 'pending'> = {};
    config.selectedTestFiles.forEach(file => {
      initialResults[file] = 'pending';
    });
    setTestResults(prev => ({ ...prev, ...initialResults }));
    
    addLog(`Starting test run for project: ${selectedProject}`);
    addLog(`Website URL: ${config.websiteUrl}`);
    addLog(`Username: ${config.username}`);
    addLog(`Selected test files: ${config.selectedTestFiles.length}`);
    
    try {
      // Initial setup steps
      const setupSteps = [
        'Setting up test environment...',
        'Launching browser instance...',
        `Navigating to ${config.websiteUrl}...`,
        `Authenticating with username: ${config.username}...`,
        'Loading selected test files...'
      ];

      for (let i = 0; i < setupSteps.length; i++) {
        await new Promise(resolve => setTimeout(resolve, 600 + Math.random() * 300));
        addLog(setupSteps[i]);
      }

      // Call the API to run tests
      const response = await fetch(`http://localhost:3001/api/projects/${selectedProject}/run-tests`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...config,
          environment: config.environment || 'local'
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      const results = data.results;

      // Update test results
      Object.entries(results.testResults).forEach(([file, status]) => {
        setTestResults(prev => ({ ...prev, [file]: status as 'passed' | 'failed' }));
      });

      // Log individual test results
      Object.entries(results.testResults).forEach(([file, status]) => {
        const icon = status === 'passed' ? '✓' : '✗';
        addLog(`Running ${file} ${icon}`);
      });

      // Final steps
      await new Promise(resolve => setTimeout(resolve, 500));
      addLog('Generating test report...');
      await new Promise(resolve => setTimeout(resolve, 300));
      addLog('Test run completed!');
      addLog(`Results: ${results.passed} passed, ${results.failed} failed, ${results.skipped} skipped`);
      addLog(`Execution time: ${Math.round(results.executionTime / 1000)}s`);

    } catch (error) {
      console.error('Error running tests:', error);
      addLog(`Error running tests: ${error instanceof Error ? error.message : 'Unknown error'}`);
      
      // Mark all selected tests as failed
      config.selectedTestFiles.forEach(file => {
        setTestResults(prev => ({ ...prev, [file]: 'failed' }));
      });
    } finally {
      setStatus('idle');
    }
  };

  const handleRunTests = (config: TestRunConfig) => {
    if (status === 'running') {
      addLog('Test run queued - waiting for current run to complete...');
      return;
    }
    runTests(config);
  };

  const handleOpenTestFile = async (filename: string) => {
    addLog(`Opening test file: ${filename}`);
    
    try {
      const response = await fetch(`http://localhost:3001/api/projects/${selectedProject}/test-file/${filename}`);
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      const file = data.file;
      
      addLog(`File loaded: ${file.name} (${Math.round(file.size / 1024)}KB)`);
      addLog(`Last modified: ${file.lastModified ? new Date(file.lastModified).toLocaleString() : 'Unknown'}`);
      
      // Create a new window/tab to display the file content
      const newWindow = window.open('', '_blank');
      if (newWindow) {
        newWindow.document.write(`
          <!DOCTYPE html>
          <html>
          <head>
            <title>${file.name} - ${selectedProject}</title>
            <style>
              body { 
                font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace; 
                margin: 0; 
                padding: 20px; 
                background: #1e1e1e; 
                color: #d4d4d4; 
                line-height: 1.5;
              }
              .header { 
                background: #2d2d30; 
                padding: 15px; 
                margin: -20px -20px 20px -20px; 
                border-bottom: 1px solid #3e3e42;
              }
              .file-info { 
                color: #9cdcfe; 
                font-size: 14px; 
                margin-bottom: 10px;
              }
              pre { 
                background: #0d1117; 
                padding: 20px; 
                border-radius: 6px; 
                overflow-x: auto; 
                border: 1px solid #30363d;
              }
              code { 
                color: #e6edf3; 
                font-size: 14px;
              }
            </style>
          </head>
          <body>
            <div class="header">
              <h1 style="margin: 0; color: #f0f6fc;">${file.name}</h1>
              <div class="file-info">
                Project: ${selectedProject} | 
                Size: ${Math.round(file.size / 1024)}KB | 
                Modified: ${file.lastModified ? new Date(file.lastModified).toLocaleString() : 'Unknown'}
              </div>
            </div>
            <pre><code>${file.content}</code></pre>
          </body>
          </html>
        `);
        newWindow.document.close();
      } else {
        addLog('Could not open new window. Please check your popup blocker settings.');
      }
      
    } catch (error) {
      console.error('Error opening test file:', error);
      addLog(`Error opening test file: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const handleOpenLatestReport = async () => {
    addLog(`Opening latest test report for ${selectedProject}...`);
    
    try {
      const response = await fetch(`http://localhost:3001/api/projects/${selectedProject}/report`);
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      const latestReport = data.latestReport;
      
      if (!latestReport) {
        addLog('No test reports found for this project.');
        return;
      }
      
      addLog(`Found report: ${latestReport.name}`);
      addLog(`Opening report in new window...`);
      
      // Open the report in a new window
      const reportUrl = `http://localhost:3001${latestReport.url}`;
      const newWindow = window.open(reportUrl, '_blank');
      
      if (!newWindow) {
        addLog('Could not open new window. Please check your popup blocker settings.');
        addLog(`Report URL: ${reportUrl}`);
      } else {
        addLog('Report opened successfully!');
      }
      
    } catch (error) {
      console.error('Error opening test report:', error);
      addLog(`Error opening test report: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const handleListTests = () => {
    addLog('Generating test list JSON...');
    if (testData) {
      addLog(`Found ${testData.tests.length} test files with ${testData.totalTests} total test cases in ${selectedProject}`);
      addLog('Test files:');
      testData.tests.forEach(test => {
        addLog(`  📁 ${test.fileName} (${test.testCount} tests)`);
        test.testNames.forEach(testName => {
          addLog(`    - ${testName}`);
        });
      });
    } else {
      addLog('No test data available. Click refresh to load tests.');
    }
  };

  const handleClearLogs = () => {
    setLogs([]);
    addLog('Logs cleared');
  };

  const handleDownloadLogs = () => {
    const logContent = logs.join('\n');
    const blob = new Blob([logContent], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${selectedProject}-logs-${new Date().toISOString().split('T')[0]}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    addLog('Logs downloaded successfully');
  };

  const handleClearCache = async () => {
    try {
      const response = await fetch(`http://localhost:3001/api/projects/${selectedProject}/test-status`, {
        method: 'DELETE'
      });
      
      if (response.ok) {
        setCachedTestStatus(null);
        setTestResults({});
        addLog('Cached test status cleared');
      } else {
        throw new Error('Failed to clear cache');
      }
    } catch (error) {
      console.error('Error clearing cache:', error);
      addLog(`Error clearing cache: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const handleRefreshCache = () => {
    fetchCachedTestStatus();
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                onClick={onBackToProjectSelection}
                className="flex items-center gap-2"
              >
                <ArrowLeft className="w-4 h-4" />
                Back to Projects
              </Button>
              <div className="h-6 border-l border-border" />
              <h1 className="text-2xl font-semibold">Playwright Web Manager</h1>
              <div className="flex items-center gap-2 text-muted-foreground">
                <Folder className="w-4 h-4" />
                <span className="text-sm">{selectedProject}</span>
              </div>
            </div>
            <StatusPill status={status} />
          </div>
        </div>
      </header>

      {/* Navigation */}
      <nav className="border-b bg-card">
        <div className="container mx-auto px-6 py-3">
          <div className="flex gap-3 items-center">
            <Button 
              variant="outline" 
              onClick={handleOpenLatestReport}
              className="flex items-center"
            >
              <ExternalLink className="w-4 h-4 mr-2" />
              Open Latest Report
            </Button>
            <Button 
              variant="outline" 
              onClick={handleListTests}
              className="flex items-center"
            >
              <FileText className="w-4 h-4 mr-2" />
              List Tests
            </Button>
            <Button 
              variant="outline" 
              onClick={fetchTestData}
              disabled={isLoadingTests}
              className="flex items-center"
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${isLoadingTests ? 'animate-spin' : ''}`} />
              Refresh Tests
            </Button>
            <Button 
              variant="outline" 
              onClick={handleClearLogs}
              className="flex items-center"
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Clear Logs
            </Button>
            <Button 
              variant="outline" 
              onClick={handleDownloadLogs}
              disabled={logs.length === 0}
              className="flex items-center"
            >
              <Download className="w-4 h-4 mr-2" />
              Download Logs
            </Button>
            <Button 
              variant="outline" 
              onClick={handleRefreshCache}
              disabled={isLoadingCache}
              className="flex items-center"
            >
              <Database className={`w-4 h-4 mr-2 ${isLoadingCache ? 'animate-pulse' : ''}`} />
              Refresh Cache
            </Button>
            <Button 
              variant="outline" 
              onClick={handleClearCache}
              disabled={!cachedTestStatus}
              className="flex items-center"
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Clear Cache
            </Button>
            <div className="ml-auto flex items-center gap-4 text-sm text-muted-foreground">
              {testData && (
                <div>
                  {testData.tests.length} files, {testData.totalTests} tests
                </div>
              )}
              {cachedTestStatus && (
                <div className="flex items-center gap-1">
                  <Clock className="w-4 h-4" />
                  <span>
                    Last run: {new Date(cachedTestStatus.cachedAt).toLocaleString()}
                  </span>
                  <span className="text-green-600">
                    ({cachedTestStatus.passed} passed, {cachedTestStatus.failed} failed)
                  </span>
                </div>
              )}
            </div>
          </div>
          {testError && (
            <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-md">
              <div className="flex items-center gap-2 text-red-800">
                <AlertCircle className="w-4 h-4" />
                <span className="text-sm font-medium">Error loading tests:</span>
                <span className="text-sm">{testError}</span>
              </div>
            </div>
          )}
        </div>
      </nav>

      {/* Main Content */}
      <main className="container mx-auto px-6 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          <RunTestsCard 
            onRunTests={handleRunTests} 
            isRunning={status === 'running'}
            testFiles={testFiles}
          />
          <QuickActionsCard
            onOpenTestFile={handleOpenTestFile}
            testFiles={testFiles}
            testResults={testResults}
          />
        </div>
        
        <LiveLogsCard logs={logs} />
      </main>
    </div>
  );
}