import React, { useState, useEffect } from 'react';
import { Button } from "./ui/button";
import { Checkbox } from "./ui/checkbox";
import { StatusPill } from "./StatusPill";
import { RunTestsCard, TestRunConfig } from "./RunTestsCard";
import { QuickActionsCard } from "./QuickActionsCard";
import { LiveLogsCard } from "./LiveLogsCard";
import { EnvironmentManager } from "./EnvironmentManager";
import { NotificationSystem, useNotifications } from "./NotificationSystem";
import { ExternalLink, FileText, Folder, ArrowLeft, RefreshCw, AlertCircle, Trash2, Download, Database, Clock, GripVertical, CheckSquare, Square, Settings, Play, MoreVertical, Menu } from "lucide-react";
import { getApiUrl } from '../config/api';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "./ui/dropdown-menu";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import {
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

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

interface IndividualTestCase {
  id: string;
  fileName: string;
  testName: string;
  filePath: string;
  selected: boolean;
  order: number;
}

export function TestDashboard({ selectedProject, onBackToProjectSelection }: TestDashboardProps) {
  const [status, setStatus] = useState('idle');
  const [logs, setLogs] = useState([]);
  const [testResults, setTestResults] = useState({});
  const [testData, setTestData] = useState(null);
  const [isLoadingTests, setIsLoadingTests] = useState(false);
  const [testError, setTestError] = useState(null);
  const [cachedTestStatus, setCachedTestStatus] = useState(null);
  const [isLoadingCache, setIsLoadingCache] = useState(false);
  const [individualTestCases, setIndividualTestCases] = useState([]);
  const [showEnvironmentManager, setShowEnvironmentManager] = useState(false);
  const [showLiveLogs, setShowLiveLogs] = useState(true);
  const [showQuickActions, setShowQuickActions] = useState(true);
  
  // Notification system
  const { notifications, addNotification, removeNotification } = useNotifications();


  // Fetch test data from API
  const fetchTestData = async () => {
    setIsLoadingTests(true);
    setTestError(null);
    try {
      const response = await fetch(getApiUrl(`/projects/${selectedProject}/tests`));
      
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

  // Convert test data to individual test cases when test data changes
  useEffect(() => {
    if (testData) {
      const individualTests = convertToIndividualTestCases(testData);
      setIndividualTestCases(individualTests);
      console.log(`Converted ${individualTests.length} individual test cases from test data`);
    }
  }, [testData]);

  const addLog = (message: string) => {
    setLogs(prev => [...prev, message]);
  };

  // Fetch cached test status
  const fetchCachedTestStatus = async () => {
    setIsLoadingCache(true);
    try {
      const response = await fetch(getApiUrl(`/projects/${selectedProject}/test-status`));
      
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
    
    // Get selected individual test cases if in individual view, otherwise use file-based selection
    let selectedTestFiles = config.selectedTestFiles;
    let testExecutionOrder: string[] = [];
    
    if (config.runMode === 'individual' && config.selectedIndividualTests) {
      const selectedTestCases = config.selectedIndividualTests;
      if (selectedTestCases.length === 0) {
        addLog('No individual test cases selected. Please select at least one test case.');
        setStatus('idle');
        return;
      }
      
      // Group selected test cases by file and create execution order
      const testCasesByFile: Record<string, string[]> = {};
      selectedTestCases.forEach(testCase => {
        if (!testCasesByFile[testCase.fileName]) {
          testCasesByFile[testCase.fileName] = [];
        }
        testCasesByFile[testCase.fileName].push(testCase.testName);
      });
      
      selectedTestFiles = Object.keys(testCasesByFile);
      testExecutionOrder = selectedTestCases.map(tc => `${tc.fileName}:${tc.testName}`);
      
      addLog(`Selected ${selectedTestCases.length} individual test cases from ${selectedTestFiles.length} files`);
      addLog(`Execution order: ${testExecutionOrder.join(' → ')}`);
    } else {
      // File-based selection mode - use the selected test files from RunTestsCard
      if (selectedTestFiles.length === 0) {
        addLog('No test files selected. Please select at least one test file.');
        setStatus('idle');
        return;
      }
      
      addLog(`Selected ${selectedTestFiles.length} test file(s): ${selectedTestFiles.join(', ')}`);
    }
    
    // Reset test results for selected files
    const initialResults: Record<string, 'passed' | 'failed' | 'pending'> = {};
    selectedTestFiles.forEach(file => {
      initialResults[file] = 'pending';
    });
    setTestResults(prev => ({ ...prev, ...initialResults }));
    
    addLog(`Starting test run for project: ${selectedProject}`);
    addLog(`Website URL: ${config.websiteUrl}`);
    addLog(`Username: ${config.username}`);
    addLog(`Selected test files: ${selectedTestFiles.length}`);
    
    // Show start notification
    addNotification({
      type: 'info',
      title: 'Tests Starting',
      message: `Running ${selectedTestFiles.length} test file${selectedTestFiles.length !== 1 ? 's' : ''}`,
      duration: 3000
    });
    
    try {
    // Initial setup steps
    const setupSteps = [
      'Setting up test environment...',
      `Authenticating with website ${config.websiteUrl} and username: ${config.username}...`,
    ];

    for (let i = 0; i < setupSteps.length; i++) {
      await new Promise(resolve => setTimeout(resolve, 800 + Math.random() * 400));
      addLog(setupSteps[i]);
    }

      // Call the API to run tests
      const requestBody = {
        ...config,
        selectedTestFiles,
        testExecutionOrder,
        environment: config.environment || 'local'
      };
      
      console.log('TestDashboard: Sending request body:', JSON.stringify(requestBody, null, 2));
      
      const response = await fetch(getApiUrl(`/projects/${selectedProject}/run-tests`), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody)
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

      // Log individual test results and show notifications
      Object.entries(results.testResults).forEach(([file, status]) => {
        const icon = status === 'passed' ? '✓' : '✗';
        addLog(`Running ${file} ${icon}`);
        
        // Show notification for each test result
        if (status === 'passed') {
          addNotification({
            type: 'success',
            title: 'Test Passed',
            message: `${file} completed successfully`,
            duration: 3000
          });
        } else if (status === 'failed') {
          addNotification({
            type: 'error',
            title: 'Test Failed',
            message: `${file} failed to complete`,
            duration: 5000
          });
        }
      });

    // Final steps
    await new Promise(resolve => setTimeout(resolve, 500));
    addLog('Generating test report...');
    await new Promise(resolve => setTimeout(resolve, 300));
    addLog('Test run completed!');
      addLog(`Results: ${results.passed} passed, ${results.failed} failed, ${results.skipped} skipped`);
      addLog(`Execution time: ${Math.round(results.executionTime / 1000)}s`);
    
    // Show summary notification
    const totalTests = results.passed + results.failed + results.skipped;
    if (results.failed === 0) {
      addNotification({
        type: 'success',
        title: 'All Tests Passed!',
        message: `${results.passed} test${results.passed !== 1 ? 's' : ''} completed successfully`,
        duration: 4000
      });
    } else {
      addNotification({
        type: 'error',
        title: 'Some Tests Failed',
        message: `${results.failed} of ${totalTests} test${totalTests !== 1 ? 's' : ''} failed`,
        duration: 6000
      });
    }

    } catch (error) {
      console.error('Error running tests:', error);
      addLog(`Error running tests: ${error instanceof Error ? error.message : 'Unknown error'}`);
      
      // Show error notification
      addNotification({
        type: 'error',
        title: 'Test Execution Failed',
        message: error instanceof Error ? error.message : 'Unknown error occurred',
        duration: 8000
      });
      
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
      const response = await fetch(getApiUrl(`/projects/${selectedProject}/test-file/${filename}`));
      
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
      const response = await fetch(getApiUrl(`/projects/${selectedProject}/report`));
      
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
      const reportUrl = `${getApiUrl('')}${latestReport.url}`;
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
      const response = await fetch(getApiUrl(`/projects/${selectedProject}/test-status`), {
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

  // Convert test data to individual test cases
  const convertToIndividualTestCases = (testData: TestData): IndividualTestCase[] => {
    const individualTests: IndividualTestCase[] = [];
    let order = 0;

    testData.tests.forEach(testFile => {
      testFile.testNames.forEach(testName => {
        individualTests.push({
          id: `${testFile.fileName}-${testName}`,
          fileName: testFile.fileName,
          testName: testName,
          filePath: testFile.filePath,
          selected: false,
          order: order++
        });
      });
    });

    return individualTests;
  };


  // Toggle individual test case selection
  const toggleTestCaseSelection = (testId: string) => {
    setIndividualTestCases(prev => 
      prev.map(test => 
        test.id === testId 
          ? { ...test, selected: !test.selected }
          : test
      )
    );
  };

  // Check/uncheck all test cases
  const toggleAllTestCases = (selectAll: boolean) => {
    setIndividualTestCases(prev => 
      prev.map(test => ({ ...test, selected: selectAll }))
    );
  };

  // Get selected test cases in order
  const getSelectedTestCasesInOrder = (): IndividualTestCase[] => {
    return individualTestCases
      .filter(test => test.selected)
      .sort((a, b) => a.order - b.order);
  };

  // Toggle individual test view
  const toggleIndividualTestView = () => {
  };

  // Run selected individual test cases
  const handleRunSelectedIndividualTests = () => {
    const selectedTestCases = getSelectedTestCasesInOrder();
    
    if (selectedTestCases.length === 0) {
      addLog('No test cases selected. Please select at least one test case.');
      return;
    }

    if (status === 'running') {
      addLog('Test execution is already in progress. Please wait for it to complete.');
      return;
    }

    addLog(`Starting execution of ${selectedTestCases.length} selected individual test cases...`);
    addLog(`Test execution order: ${selectedTestCases.map(tc => tc.testName).join(' → ')}`);
    
    // Create a minimal config for individual test execution
    const config: TestRunConfig = {
      selectedTestFiles: [], // Will be populated by runTests function
      username: 'testuser', // Default username
      password: 'testpass', // Default password
      websiteUrl: 'http://localhost:3000', // Default URL
      environment: 'custom',
      runWithUI: false // Default to headless mode for individual tests
    };

    // Force individual test mode and run
    runTests(config);
  };

  // Run a single test case
  const handleRunSingleTestCase = (testCase: IndividualTestCase) => {
    if (status === 'running') {
      addLog('Test execution is already in progress. Please wait for it to complete.');
      return;
    }

    addLog(`Starting execution of single test case: ${testCase.testName}`);
    
    // Create a config for single test execution
    const config: TestRunConfig = {
      selectedTestFiles: [], // Will be populated by runTests function
      username: 'testuser', // Default username
      password: 'testpass', // Default password
      websiteUrl: 'http://localhost:3000', // Default URL
      environment: 'custom',
      runWithUI: false // Default to headless mode for individual tests
    };

    // Temporarily select only this test case
    const originalSelection = individualTestCases.map(tc => tc.selected);
    setIndividualTestCases(prev => 
      prev.map(tc => ({
        ...tc,
        selected: tc.id === testCase.id
      }))
    );

    // Force individual test mode and run
    runTests(config);

    // Restore original selection after a delay
    setTimeout(() => {
      setIndividualTestCases(prev => 
        prev.map((tc, index) => ({
          ...tc,
          selected: originalSelection[index]
        }))
      );
    }, 1000);
  };

  // Sortable Test Case Item Component
  const SortableTestCaseItem = ({ testCase }: { testCase: IndividualTestCase }) => {
    const {
      attributes,
      listeners,
      setNodeRef,
      transform,
      transition,
      isDragging,
    } = useSortable({ id: testCase.id });

    const style = {
      transform: CSS.Transform.toString(transform),
      transition,
      opacity: isDragging ? 0.5 : 1,
    };

    return (
      <div
        ref={setNodeRef}
        style={style}
        className={`flex items-center gap-3 p-3 border rounded-lg bg-card hover:bg-muted/50 transition-colors ${
          isDragging ? 'shadow-lg' : ''
        }`}
      >
        <div
          {...attributes}
          {...listeners}
          className="cursor-grab hover:cursor-grabbing p-1 text-muted-foreground hover:text-foreground"
        >
          <GripVertical className="w-4 h-4" />
        </div>
        
        <Checkbox
          checked={testCase.selected}
          onCheckedChange={() => toggleTestCaseSelection(testCase.id)}
          className="flex-shrink-0"
        />
        
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium text-sm truncate">
              {testCase.testName}
            </span>
            <span className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded">
              {testCase.fileName}
            </span>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <div className="text-xs text-muted-foreground">
            #{testCase.order + 1}
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleRunSingleTestCase(testCase)}
            disabled={status === 'running'}
            className="flex items-center gap-1 h-6 px-2 text-xs"
          >
            <Play className="w-3 h-3" />
            Run
          </Button>
        </div>
      </div>
    );
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
            {/* Primary Actions */}
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
              onClick={handleOpenLatestReport}
              className="flex items-center"
            >
              <ExternalLink className="w-4 h-4 mr-2" />
              Latest Report
            </Button>

            {/* View Controls */}
            <div className="flex items-center gap-2">
              <Button 
                variant={showQuickActions ? "default" : "outline"}
                size="sm"
                onClick={() => setShowQuickActions(!showQuickActions)}
                className="flex items-center"
              >
                <Menu className="w-4 h-4 mr-1" />
                Quick Actions
              </Button>
              
              <Button 
                variant={showLiveLogs ? "default" : "outline"}
                size="sm"
                onClick={() => setShowLiveLogs(!showLiveLogs)}
                className="flex items-center"
              >
                <FileText className="w-4 h-4 mr-1" />
                Live Logs
              </Button>
            </div>

            {/* More Actions Dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  <MoreVertical className="w-4 h-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => setShowEnvironmentManager(!showEnvironmentManager)}>
                  <Settings className="w-4 h-4 mr-2" />
                  {showEnvironmentManager ? 'Hide' : 'Manage'} Environments
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleClearLogs}>
                  <Trash2 className="w-4 h-4 mr-2" />
                  Clear Logs
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleDownloadLogs} disabled={logs.length === 0}>
                  <Download className="w-4 h-4 mr-2" />
                  Download Logs
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleRefreshCache} disabled={isLoadingCache}>
                  <Database className={`w-4 h-4 mr-2 ${isLoadingCache ? 'animate-pulse' : ''}`} />
                  Refresh Cache
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleClearCache} disabled={!cachedTestStatus}>
                  <Trash2 className="w-4 h-4 mr-2" />
                  Clear Cache
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={async () => {
                  addLog('Starting Playwright report server...');
                  try {
                    const response = await fetch(getApiUrl(`/projects/${selectedProject}/start-report`), {
                      method: 'POST'
                    });
                    
                    if (response.ok) {
                      const data = await response.json();
                      addLog('Playwright report server started. Opening in browser...');
                      setTimeout(() => {
                        window.open(data.url, '_blank');
                      }, 2000);
                    } else {
                      throw new Error('Failed to start report server');
                    }
                  } catch (error) {
                    addLog(`Error starting report server: ${error instanceof Error ? error.message : 'Unknown error'}`);
                  }
                }}>
                  <ExternalLink className="w-4 h-4 mr-2" />
                  Show Report
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Status Info */}
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
        <div className={`grid gap-6 mb-6 ${showQuickActions ? 'grid-cols-1 lg:grid-cols-2' : 'grid-cols-1'}`}>
          <RunTestsCard 
            onRunTests={handleRunTests} 
            isRunning={status === 'running'}
            testFiles={testFiles}
            individualTestCases={individualTestCases}
            onIndividualTestCaseToggle={toggleTestCaseSelection}
            onToggleAllIndividualTests={toggleAllTestCases}
          />
          {showQuickActions && (
            <QuickActionsCard
              onOpenTestFile={handleOpenTestFile}
              testFiles={testFiles}
              testResults={testResults}
            />
          )}
        </div>

        {/* Environment Manager */}
        {showEnvironmentManager && (
          <div className="mb-6">
            <EnvironmentManager 
              onEnvironmentChange={() => {
                addLog('Environment configuration updated');
                // Refresh the RunTestsCard to get updated environment config
                window.location.reload();
              }}
            />
          </div>
        )}

        
        {showLiveLogs && <LiveLogsCard logs={logs} />}
      </main>
      
      {/* Notification System */}
      <NotificationSystem 
        notifications={notifications} 
        onRemove={removeNotification} 
      />
    </div>
  );
}