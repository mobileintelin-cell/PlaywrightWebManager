import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "./ui/dialog";
import { Play, Globe, User, Lock, HelpCircle, Download, Settings, Code, TestTube, Users } from "lucide-react";
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
  individualTestCases?: IndividualTestCase[];
  onIndividualTestCaseToggle?: (testId: string) => void;
  onToggleAllIndividualTests?: (selectAll: boolean) => void;
  projectPath?: string | null;
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
  runWithUI?: boolean;
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
  individualTestCases = [], 
  onIndividualTestCaseToggle,
  onToggleAllIndividualTests,
  projectPath
}: RunTestsCardProps) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [environment, setEnvironment] = useState('custom');
  const [showHelpDialog, setShowHelpDialog] = useState(false);
  const [customUrl, setCustomUrl] = useState('');
  const [environmentConfig, setEnvironmentConfig] = useState(null);
  const [isLoadingEnvironments, setIsLoadingEnvironments] = useState(false);

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
      const url = projectPath 
        ? `${getApiUrl('/environments')}?projectPath=${encodeURIComponent(projectPath)}`
        : getApiUrl('/environments');
      
      const response = await fetch(url);
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

  // Load environment configuration on component mount and when projectPath changes
  useEffect(() => {
    fetchEnvironmentConfig();
  }, [projectPath]);

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


  const handleRun = () => {
    const selectedIndividualTests = individualTestCases.filter(test => test.selected);
    
    // Get unique file names from selected individual tests
    const selectedTestFiles = [...new Set(selectedIndividualTests.map(test => test.fileName))];
    
    onRunTests({
      selectedTestFiles,
      selectedIndividualTests,
      username,
      password,
      websiteUrl: getWebsiteUrl(),
      environment,
      runMode: 'individual' // Always use individual mode since we're selecting specific tests
    });
  };


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


        
        <Button 
          onClick={handleRun} 
          disabled={
            isRunning || 
            !environment || 
            (environment === 'custom' && !customUrl) ||
            individualTestCases.filter(t => t.selected).length === 0
          }
          className="w-full"
        >
          <Play className="w-4 h-4 mr-2" />
          {isRunning ? 'Running...' : (() => {
            const count = individualTestCases.filter(t => t.selected).length;
            return `Run ${count} Test${count !== 1 ? 's' : ''}`;
          })()}
        </Button>
        
        {isRunning && (
          <p className="text-sm text-muted-foreground mt-2">
            Runs are queued if one is in progress.
          </p>
        )}
        
        {individualTestCases.filter(t => t.selected).length === 0 && (
          <p className="text-sm text-muted-foreground">
            Please select at least one test to run.
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