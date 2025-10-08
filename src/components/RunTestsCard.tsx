import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Checkbox } from "./ui/checkbox";
import { ScrollArea } from "./ui/scroll-area";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "./ui/dialog";
import { Play, Globe, User, Lock, FileText, HelpCircle, Download, Settings, Code, TestTube, Users } from "lucide-react";
import { getApiUrl } from '../config/api';

interface IndividualTestCase {
  id: string;
  fileName: string;
  testName: string;
  filePath: string;
  selected: boolean;
  order: number;
}

interface RunTestsCardProps {
  onRunTests: (config: TestRunConfig) => void;
  isRunning: boolean;
  testFiles: string[];
  individualTestCases?: IndividualTestCase[];
  onIndividualTestCaseToggle?: (testId: string) => void;
  onToggleAllIndividualTests?: (selectAll: boolean) => void;
}

export interface TestRunConfig {
  selectedTestFiles: string[];
  selectedIndividualTests?: IndividualTestCase[];
  username: string;
  password: string;
  websiteUrl: string;
  environment: string;
  testExecutionOrder?: string[];
  runMode?: 'files' | 'individual';
}

interface Environment {
  id: string;
  name: string;
  description: string;
  url: string;
  defaultUrl: string;
  requiresUrl: boolean;
  color: string;
  icon: string;
}

interface EnvironmentConfig {
  environments: Record<string, Environment>;
  defaultEnvironment: string;
  errorContext: {
    enabled: boolean;
    captureScreenshots: boolean;
    captureVideos: boolean;
    captureTraces: boolean;
    maxRetries: number;
    timeout: number;
  };
}

export function RunTestsCard({ 
  onRunTests, 
  isRunning, 
  testFiles, 
  individualTestCases = [], 
  onIndividualTestCaseToggle,
  onToggleAllIndividualTests 
}: RunTestsCardProps) {
  const [selectedTestFiles, setSelectedTestFiles] = useState([]);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [environment, setEnvironment] = useState('custom');
  const [showHelpDialog, setShowHelpDialog] = useState(false);
  const [customUrl, setCustomUrl] = useState('');
  const [environmentConfig, setEnvironmentConfig] = useState(null);
  const [isLoadingEnvironments, setIsLoadingEnvironments] = useState(false);
  const [testMode, setTestMode] = useState('files');

  // Debug: Log when individual test cases change
  useEffect(() => {
    console.log(`RunTestsCard: ${individualTestCases.length} individual test cases available`);
  }, [individualTestCases]);

  // Load cached values on component mount
  useEffect(() => {
    try {
      const cachedUrl = localStorage.getItem('playwright-custom-url');
      const cachedUsername = localStorage.getItem('playwright-username');
      const cachedPassword = localStorage.getItem('playwright-password');
      const cachedEnvironment = localStorage.getItem('playwright-environment');
      
      if (cachedUrl) {
        setCustomUrl(cachedUrl);
      }
      if (cachedUsername) {
        setUsername(cachedUsername);
      }
      if (cachedPassword) {
        setPassword(cachedPassword);
      }
      if (cachedEnvironment) {
        setEnvironment(cachedEnvironment);
      }
    } catch (error) {
      console.error('Error loading cached values:', error);
    }
  }, []);

  // Cache custom URL whenever it changes
  const handleCustomUrlChange = (value: string) => {
    setCustomUrl(value);
    try {
      localStorage.setItem('playwright-custom-url', value);
    } catch (error) {
      console.error('Error caching custom URL:', error);
    }
  };

  // Cache username whenever it changes
  const handleUsernameChange = (value: string) => {
    setUsername(value);
    try {
      localStorage.setItem('playwright-username', value);
    } catch (error) {
      console.error('Error caching username:', error);
    }
  };

  // Cache password whenever it changes
  const handlePasswordChange = (value: string) => {
    setPassword(value);
    try {
      localStorage.setItem('playwright-password', value);
    } catch (error) {
      console.error('Error caching password:', error);
    }
  };

  // Cache environment whenever it changes
  const handleEnvironmentChange = (value: string) => {
    setEnvironment(value);
    try {
      localStorage.setItem('playwright-environment', value);
    } catch (error) {
      console.error('Error caching environment:', error);
    }
  };


  // Fetch environment configuration
  const fetchEnvironmentConfig = async () => {
    setIsLoadingEnvironments(true);
    try {
      const response = await fetch(getApiUrl('/environments'));
      if (response.ok) {
        const data = await response.json();
        console.log('Environment config loaded:', data);
        setEnvironmentConfig(data);
        if (data.defaultEnvironment) {
          setEnvironment(data.defaultEnvironment);
        }
      } else {
        console.error('Failed to fetch environment config:', response.status, response.statusText);
        // Set fallback configuration
        setEnvironmentConfig({
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
        });
      }
    } catch (error) {
      console.error('Error fetching environment config:', error);
      // Set fallback configuration
      setEnvironmentConfig({
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
      });
    } finally {
      setIsLoadingEnvironments(false);
    }
  };

  // Load environment configuration on component mount
  useEffect(() => {
    fetchEnvironmentConfig();
  }, []);

  // Log cached values when they change (for debugging)
  useEffect(() => {
    if (environmentConfig) {
      logCachedValues();
    }
  }, [customUrl, username, password, environment, environmentConfig]);

  // Reset environment if it becomes invalid
  useEffect(() => {
    if (environmentConfig && !environmentConfig.environments?.[environment] && environment !== 'custom') {
      console.warn('Current environment is invalid, resetting to custom');
      setEnvironment('custom');
    }
  }, [environmentConfig, environment]);

  const getWebsiteUrl = () => {
    try {
      if (!environmentConfig) return customUrl;
      
      const env = environmentConfig.environments?.[environment];
      if (!env) return customUrl;
      
      if (env.requiresUrl) {
        return customUrl;
      }
      
      return env.url || customUrl;
    } catch (error) {
      console.error('Error in getWebsiteUrl:', error);
      return customUrl;
    }
  };

  // Utility function to clear all cached values
  const clearCache = () => {
    try {
      localStorage.removeItem('playwright-custom-url');
      localStorage.removeItem('playwright-username');
      localStorage.removeItem('playwright-password');
      localStorage.removeItem('playwright-environment');
      localStorage.removeItem('playwright-run-with-ui');
      
      // Reset to default values
      setCustomUrl('');
      setUsername('');
      setPassword('');
      setEnvironment('custom');
      
      console.log('Cache cleared successfully');
    } catch (error) {
      console.error('Error clearing cache:', error);
    }
  };

  // Debug function to log current cached values
  const logCachedValues = () => {
    try {
      const cached = {
        url: localStorage.getItem('playwright-custom-url'),
        username: localStorage.getItem('playwright-username'),
        password: localStorage.getItem('playwright-password'),
        environment: localStorage.getItem('playwright-environment'),
        currentWebsiteUrl: getWebsiteUrl()
      };
      console.log('Current cached values:', cached);
    } catch (error) {
      console.error('Error logging cached values:', error);
    }
  };

  const getEnvironmentIcon = (iconName: string) => {
    switch (iconName) {
      case 'settings': return Settings;
      case 'code': return Code;
      case 'test-tube': return TestTube;
      case 'users': return Users;
      case 'globe': return Globe;
      default: return Globe;
    }
  };

  const downloadLinuxScript = () => {
    const linuxScript = `#!/bin/bash

# Playwright Test Runner - Linux Setup Script
# Hướng dẫn: Di chuyển file này vào thư mục home của bạn và chạy

echo "Đang cài đặt Playwright Test Runner..."

# Tạo thư mục playwright-tests nếu chưa có
mkdir -p ~/playwright-tests
cd ~/playwright-tests

# Cài đặt Node.js dependencies
npm init -y
npm install @playwright/test

# Tạo file cấu hình mẫu
cat > playwright.config.js << EOF
module.exports = {
  testDir: './tests',
  use: {
    headless: true,
    viewport: { width: 1280, height: 720 },
    ignoreHTTPSErrors: true,
  },
};
EOF

# Tạo thư mục tests
mkdir -p tests

echo "✅ Cài đặt hoàn tất!"
echo "📁 Thư mục test của bạn: ~/playwright-tests"
echo "🚀 Chạy lệnh: cd ~/playwright-tests && npx playwright test"
`;

    const blob = new Blob([linuxScript], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'playwright-setup-linux.sh';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const downloadWindowsScript = () => {
    const windowsScript = `@echo off
REM Playwright Test Runner - Windows Setup Script
REM Hướng dẫn: Di chuyển file này vào thư mục Desktop và chạy

echo Đang cài đặt Playwright Test Runner...

REM Tạo thư mục playwright-tests
if not exist "%USERPROFILE%\\playwright-tests" mkdir "%USERPROFILE%\\playwright-tests"
cd /d "%USERPROFILE%\\playwright-tests"

REM Cài đặt Node.js dependencies
call npm init -y
call npm install @playwright/test

REM Tạo file cấu hình mẫu
(
echo module.exports = {
echo   testDir: './tests',
echo   use: {
echo     headless: true,
echo     viewport: { width: 1280, height: 720 },
echo     ignoreHTTPSErrors: true,
echo   },
echo };
) > playwright.config.js

REM Tạo thư mục tests
if not exist "tests" mkdir "tests"

echo.
echo ✅ Cài đặt hoàn tất!
echo 📁 Thư mục test của bạn: %USERPROFILE%\\playwright-tests
echo 🚀 Chạy lệnh: cd %USERPROFILE%\\playwright-tests ^&^& npx playwright test
pause
`;

    const blob = new Blob([windowsScript], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'playwright-setup-windows.bat';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleTestFileToggle = (filename: string, checked: boolean) => {
    if (checked) {
      setSelectedTestFiles(prev => [...prev, filename]);
    } else {
      setSelectedTestFiles(prev => prev.filter(file => file !== filename));
    }
  };

  const handleSelectAll = () => {
    if (selectedTestFiles.length === testFiles.length) {
      setSelectedTestFiles([]);
    } else {
      setSelectedTestFiles([...testFiles]);
    }
  };

  const handleRun = () => {
    const selectedIndividualTests = individualTestCases.filter(test => test.selected);
    
    
    onRunTests({
      selectedTestFiles,
      selectedIndividualTests,
      username,
      password,
      websiteUrl: getWebsiteUrl(),
      environment,
      runMode: testMode
    });
  };

  const isAllSelected = selectedTestFiles.length === testFiles.length;
  const isSomeSelected = selectedTestFiles.length > 0 && selectedTestFiles.length < testFiles.length;

  return (
    <Card className="h-fit">
      <CardHeader>
        <CardTitle>Run Tests</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Credentials Section */}
        <div className="space-y-3">
          <div className="space-y-2">
            <Label htmlFor="environment" className="flex items-center gap-2">
              <Globe className="w-4 h-4" />
              Website URL
            </Label>
            <Select 
              value={environmentConfig?.environments?.[environment] ? environment : 'custom'} 
              onValueChange={(value) => {
                try {
                  console.log('Environment changed to:', value);
                  // Validate that the environment exists in the config
                  if (environmentConfig?.environments?.[value] || value === 'custom') {
                    handleEnvironmentChange(value);
                  } else {
                    console.warn('Invalid environment selected:', value);
                    handleEnvironmentChange('custom');
                  }
                } catch (error) {
                  console.error('Error changing environment:', error);
                  setEnvironment('custom');
                }
              }} 
              disabled={isLoadingEnvironments}
            >
              <SelectTrigger>
                <SelectValue placeholder={isLoadingEnvironments ? "Loading environments..." : "Select environment"} />
              </SelectTrigger>
              <SelectContent>
                {environmentConfig?.environments ? Object.entries(environmentConfig.environments).map(([envId, env]: [string, any]) => {
                  try {
                    const IconComponent = getEnvironmentIcon(env.icon);
                    return (
                      <SelectItem key={envId} value={envId}>
                        <div className="flex items-center gap-2">
                          <IconComponent className="w-4 h-4" style={{ color: env.color }} />
                          <span>{env.name}</span>
                        </div>
                      </SelectItem>
                    );
                  } catch (error) {
                    console.error(`Error rendering environment ${envId}:`, error);
                    return (
                      <SelectItem key={envId} value={envId}>
                        <span>{env.name || envId}</span>
                      </SelectItem>
                    );
                  }
                }) : (
                  <SelectItem value="custom">Custom</SelectItem>
                )}
              </SelectContent>
            </Select>
            {environmentConfig?.environments?.[environment]?.requiresUrl && (
              <div className="mt-2 flex gap-2">
                <Input
                  id="custom-url"
                  type="url"
                  value={customUrl}
                  onChange={(e) => handleCustomUrlChange(e.target.value)}
                  placeholder="https://example.com"
                  className="flex-1"
                />
                <Dialog open={showHelpDialog} onOpenChange={setShowHelpDialog}>
                  <DialogTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="shrink-0"
                      title="Hướng dẫn cài đặt"
                    >
                      <HelpCircle className="w-4 h-4" />
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-md">
                    <DialogHeader>
                      <DialogTitle>Hướng dẫn cài đặt Custom URL</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <h4>Bước thực hiện:</h4>
                        <ol className="list-decimal list-inside space-y-1 text-sm text-muted-foreground">
                          <li>Tải file script phù hợp với hệ điều hành</li>
                          <li><strong>Linux:</strong> Di chuyển vào thư mục home (~)</li>
                          <li><strong>Windows:</strong> Di chuyển vào Desktop</li>
                          <li>Chạy file script</li>
                          <li>Done! ✅</li>
                        </ol>
                      </div>
                      
                      <div className="space-y-3">
                        <h4>Tải script cài đặt:</h4>
                        <div className="flex gap-2">
                          <Button
                            onClick={downloadLinuxScript}
                            variant="outline"
                            className="flex-1"
                          >
                            <Download className="w-4 h-4 mr-2" />
                            Linux
                          </Button>
                          <Button
                            onClick={downloadWindowsScript}
                            variant="outline"
                            className="flex-1"
                          >
                            <Download className="w-4 h-4 mr-2" />
                            Windows
                          </Button>
                        </div>
                      </div>
                      
                      <div className="p-3 bg-muted rounded-lg">
                        <p className="text-sm text-muted-foreground">
                          <strong>Lưu ý:</strong> Sau khi chạy script, bạn sẽ có thư mục playwright-tests với cấu hình cơ bản để chạy test.
                        </p>
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
            )}
            {environment && environment !== 'custom' && environmentConfig?.environments?.[environment] && (
              <div className="text-sm text-muted-foreground mt-1">
                {environmentConfig.environments[environment].url || environmentConfig.environments[environment].description}
              </div>
            )}
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="username" className="flex items-center gap-2">
              <User className="w-4 h-4" />
              Username
            </Label>
            <Input
              id="username"
              value={username}
              onChange={(e) => handleUsernameChange(e.target.value)}
              placeholder="Enter username"
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="password" className="flex items-center gap-2">
              <Lock className="w-4 h-4" />
              Password
            </Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => handlePasswordChange(e.target.value)}
              placeholder="Enter password"
            />
          </div>
        </div>


        {/* Test Mode Toggle */}
        <div className="space-y-2">
          <Label className="text-sm font-medium">Test Selection Mode</Label>
          <div className="flex gap-2">
            <Button
              variant={testMode === 'files' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setTestMode('files')}
              className="flex-1"
            >
              <FileText className="w-4 h-4 mr-2" />
              Test Files
            </Button>
            <Button
              variant={testMode === 'individual' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setTestMode('individual')}
              className="flex-1"
              disabled={individualTestCases.length === 0}
            >
              <Play className="w-4 h-4 mr-2" />
              Individual Tests
            </Button>
          </div>
        </div>

        {/* Test Files Section */}
        {testMode === 'files' && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="flex items-center gap-2">
                <FileText className="w-4 h-4" />
                Test Files ({selectedTestFiles.length}/{testFiles.length})
              </Label>
              <Button
                variant="outline"
                size="sm"
                onClick={handleSelectAll}
                className="text-xs"
              >
                {isAllSelected ? 'Deselect All' : 'Select All'}
              </Button>
            </div>
          
          <ScrollArea className="h-48 border rounded-md p-2">
            <div className="space-y-2">
              {testFiles.map((file) => (
                <div key={file} className="flex items-center space-x-2">
                  <Checkbox
                    id={file}
                    checked={selectedTestFiles.includes(file)}
                    onCheckedChange={(checked) => handleTestFileToggle(file, checked as boolean)}
                  />
                  <Label 
                    htmlFor={file} 
                    className="text-sm cursor-pointer flex-1 leading-relaxed"
                  >
                    {file}
                  </Label>
                </div>
              ))}
            </div>
          </ScrollArea>
          </div>
        )}

        {/* Individual Tests Section */}
        {testMode === 'individual' && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="flex items-center gap-2">
                <Play className="w-4 h-4" />
                Individual Tests ({individualTestCases.filter(t => t.selected).length}/{individualTestCases.length})
              </Label>
              <Button
                variant="outline"
                size="sm"
                onClick={() => onToggleAllIndividualTests?.(!individualTestCases.every(t => t.selected))}
                className="text-xs"
                disabled={individualTestCases.length === 0}
              >
                {individualTestCases.every(t => t.selected) ? 'Deselect All' : 'Select All'}
              </Button>
            </div>
            
            <ScrollArea className="h-48 border rounded-md p-2">
              <div className="space-y-2">
                {individualTestCases.length === 0 ? (
                  <div className="text-sm text-muted-foreground text-center py-4">
                    No individual tests available. Switch to "Test Files" mode or refresh the test data.
                  </div>
                ) : (
                  individualTestCases.map((testCase) => (
                    <div key={testCase.id} className="flex items-center space-x-2">
                      <Checkbox
                        id={testCase.id}
                        checked={testCase.selected}
                        onCheckedChange={() => onIndividualTestCaseToggle?.(testCase.id)}
                      />
                      <Label 
                        htmlFor={testCase.id} 
                        className="text-sm cursor-pointer flex-1 leading-relaxed"
                      >
                        <div className="flex flex-col">
                          <span className="font-medium">{testCase.testName}</span>
                          <span className="text-xs text-muted-foreground">{testCase.fileName}</span>
                        </div>
                      </Label>
                    </div>
                  ))
                )}
              </div>
            </ScrollArea>
          </div>
        )}
        
        <Button 
          onClick={handleRun} 
          disabled={
            isRunning || 
            !environment || 
            (environment === 'custom' && !customUrl) ||
            (testMode === 'files' && selectedTestFiles.length === 0) ||
            (testMode === 'individual' && individualTestCases.filter(t => t.selected).length === 0)
          }
          className="w-full"
        >
          <Play className="w-4 h-4 mr-2" />
          {isRunning ? 'Running...' : (() => {
            const count = testMode === 'files' 
              ? selectedTestFiles.length 
              : individualTestCases.filter(t => t.selected).length;
            const type = testMode === 'files' ? 'File' : 'Test';
            return `Run ${count} ${type}${count !== 1 ? 's' : ''}`;
          })()}
        </Button>
        
        {isRunning && (
          <p className="text-sm text-muted-foreground mt-2">
            Runs are queued if one is in progress.
          </p>
        )}
        
        {testMode === 'files' && selectedTestFiles.length === 0 && (
          <p className="text-sm text-muted-foreground">
            Please select at least one test file to run.
          </p>
        )}
        
        {testMode === 'individual' && individualTestCases.filter(t => t.selected).length === 0 && (
          <p className="text-sm text-muted-foreground">
            Please select at least one individual test to run.
          </p>
        )}
        
        {!environment && (
          <p className="text-sm text-muted-foreground">
            Please select an environment.
          </p>
        )}
        
        {environment === 'custom' && !customUrl && (
          <p className="text-sm text-muted-foreground">
            Please enter a custom URL.
          </p>
        )}
      </CardContent>
    </Card>
  );
}