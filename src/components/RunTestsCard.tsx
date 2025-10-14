import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "./ui/dialog";
import { Badge } from "./ui/badge";
import { Play, Globe, User, Lock, HelpCircle, Download, Settings, Code, TestTube, Users, Edit2, Check, X } from "lucide-react";
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
  const [editingUrls, setEditingUrls] = useState({});
  const [isSavingUrl, setIsSavingUrl] = useState(false);

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

  const handleUrlEdit = (envId: string, url: string) => {
    console.log('handleUrlEdit called:', {
      envId,
      url,
      environmentConfig: environmentConfig?.environments ? Object.keys(environmentConfig.environments) : 'none',
      isLoadingEnvironments
    });
    
    if (!environmentConfig || !environmentConfig.environments || !environmentConfig.environments[envId]) {
      console.error('Cannot edit URL: Environment configuration not loaded or environment not found');
      alert('Environment configuration not loaded. Please wait and try again.');
      return;
    }
    
    setEditingUrls(prev => ({
      ...prev,
      [envId]: url
    }));
  };

  const handleUrlSave = async (envId: string) => {
    if (!editingUrls[envId]) return;
    
    if (!environmentConfig || !environmentConfig.environments || !environmentConfig.environments[envId]) {
      console.error('Environment configuration not loaded or environment not found:', {
        envId,
        environmentConfig,
        availableEnvironments: environmentConfig?.environments ? Object.keys(environmentConfig.environments) : 'none'
      });
      
      // Try to reload environment configuration
      console.log('Attempting to reload environment configuration...');
      await fetchEnvironmentConfig();
      
      // Check again after reload
      if (!environmentConfig || !environmentConfig.environments || !environmentConfig.environments[envId]) {
        alert('Environment configuration not loaded. Please refresh the page and try again.');
        return;
      }
    }
    
    setIsSavingUrl(true);
    try {
      const environment = environmentConfig.environments[envId];
      
      // Check if this is a Playwright project environment
      if (environment.isPlaywrightProject) {
        console.log('Updating Playwright project environment:', envId);
        
        // Update Playwright config instead of environment config
        const projectName = projectPath?.split('/').pop() || 'default';
        
        // Get current Playwright config
        const configResponse = await fetch(getApiUrl(`/projects/${projectName}/playwright-config`));
        if (!configResponse.ok) {
          throw new Error('Failed to load Playwright config');
        }
        
        const configData = await configResponse.json();
        const projects = configData.config.projects.map(project => ({
          name: project.name,
          baseURL: project.name === envId ? editingUrls[envId] : project.baseURL
        }));
        
        console.log('Updating Playwright config with projects:', projects);
        
        // Update Playwright config
        const updateResponse = await fetch(getApiUrl(`/projects/${projectName}/playwright-config`), {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            configPath: configData.configPath,
            projects: projects
          })
        });
        
        if (!updateResponse.ok) {
          const errorData = await updateResponse.json().catch(() => ({}));
          throw new Error(errorData.message || `HTTP error! status: ${updateResponse.status}`);
        }
        
        console.log('Playwright config updated successfully');
        
        // Reload environment configuration to get updated values
        await fetchEnvironmentConfig();
        
      } else {
        console.log('Updating traditional environment:', envId);
        
        // Use traditional environment configuration update
        const url = getApiUrl(`/environments/${envId}`);
        const body = {
          url: editingUrls[envId],
          projectPath: projectPath
        };
        
        console.log('Saving environment URL:', {
          envId,
          url,
          body,
          editingUrls,
          environmentConfig: environmentConfig?.environments ? Object.keys(environmentConfig.environments) : 'none',
          projectPath: projectPath
        });
        
        const response = await fetch(url, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(body),
        });

        console.log('Response received:', {
          status: response.status,
          statusText: response.statusText,
          ok: response.ok,
          url: response.url
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error('Error response body:', errorText);
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const result = await response.json();
        console.log('Environment URL updated:', result);

        // Update local environment config
        setEnvironmentConfig(prev => ({
          ...prev,
          environments: {
            ...prev.environments,
            [envId]: {
              ...prev.environments[envId],
              url: editingUrls[envId]
            }
          }
        }));
      }

      // Clear editing state
      setEditingUrls(prev => {
        const newState = { ...prev };
        delete newState[envId];
        return newState;
      });

    } catch (error) {
      console.error('Error saving environment URL:', error);
      const errorMessage = error.message.includes('404') 
        ? `Environment "${envId}" not found. Please refresh the page and try again.`
        : 'Failed to save environment URL. Please try again.';
      alert(errorMessage);
    } finally {
      setIsSavingUrl(false);
    }
  };

  const handleUrlCancel = (envId: string) => {
    setEditingUrls(prev => {
      const newState = { ...prev };
      delete newState[envId];
      return newState;
    });
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


  // Fetch environment configuration from Playwright config
  const fetchEnvironmentConfig = async () => {
    setIsLoadingEnvironments(true);
    try {
      // First try to load from Playwright config
      const projectName = projectPath?.split('/').pop() || 'default';
      const playwrightUrl = getApiUrl(`/projects/${projectName}/playwright-environments`);
      
      console.log('Fetching Playwright environments from:', playwrightUrl);
      console.log('Project path:', projectPath);
      
      const playwrightResponse = await fetch(playwrightUrl);
      console.log('Playwright environments response:', {
        status: playwrightResponse.status,
        statusText: playwrightResponse.statusText,
        ok: playwrightResponse.ok
      });
      
      if (playwrightResponse.ok) {
        const playwrightData = await playwrightResponse.json();
        if (playwrightData.success && playwrightData.environments.length > 0) {
          console.log('Playwright environments loaded successfully:', {
            environments: playwrightData.environments.map(env => env.id),
            defaultEnvironment: playwrightData.defaultEnvironment
          });
          
          // Convert to the expected format
          const environments = {};
          playwrightData.environments.forEach(env => {
            environments[env.id] = {
              id: env.id,
              name: env.name,
              description: env.description,
              url: env.url,
              defaultUrl: env.defaultUrl,
              requiresUrl: env.requiresUrl,
              color: env.color,
              icon: env.icon,
              isPlaywrightProject: env.isPlaywrightProject,
              baseURL: env.baseURL
            };
          });
          
          setEnvironmentConfig({
            environments,
            defaultEnvironment: playwrightData.defaultEnvironment
          });
          
          if (playwrightData.defaultEnvironment) {
            setEnvironment(playwrightData.defaultEnvironment);
          }
          
          setIsLoadingEnvironments(false);
          return;
        }
      }
      
      // Fallback to original environment config
      const url = projectPath 
        ? `${getApiUrl('/environments')}?projectPath=${encodeURIComponent(projectPath)}`
        : getApiUrl('/environments');
      
      console.log('Fallback: Fetching environment config from:', url);
      
      const response = await fetch(url);
      console.log('Environment config response:', {
        status: response.status,
        statusText: response.statusText,
        ok: response.ok
      });
      
      if (response.ok) {
        const data = await response.json();
        console.log('Environment config loaded successfully:', {
          success: data.success,
          environments: Object.keys(data.environments || {}),
          defaultEnvironment: data.defaultEnvironment
        });
        setEnvironmentConfig(data);
        if (data.defaultEnvironment) {
          setEnvironment(data.defaultEnvironment);
        }
      } else {
        const errorText = await response.text();
        console.error('Failed to fetch environment config:', {
          status: response.status,
          statusText: response.statusText,
          body: errorText,
          url
        });
        // Set fallback configuration with all standard environments
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
            },
            dev: {
              id: "dev",
              name: "Development",
              description: "Development environment",
              url: "http://localhost:3000",
              defaultUrl: "http://localhost:3000",
              requiresUrl: false,
              color: "#10b981",
              icon: "code"
            },
            staging: {
              id: "staging",
              name: "Staging",
              description: "Staging environment for testing",
              url: "https://staging.example.com",
              defaultUrl: "https://staging.example.com",
              requiresUrl: false,
              color: "#f59e0b",
              icon: "test-tube"
            },
            uat: {
              id: "uat",
              name: "UAT",
              description: "User Acceptance Testing environment",
              url: "https://uat.example.com",
              defaultUrl: "https://uat.example.com",
              requiresUrl: false,
              color: "#8b5cf6",
              icon: "users"
            },
            production: {
              id: "production",
              name: "Production",
              description: "Production environment",
              url: "https://example.com",
              defaultUrl: "https://example.com",
              requiresUrl: false,
              color: "#ef4444",
              icon: "globe"
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
      // Set fallback configuration with all standard environments
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
          },
          dev: {
            id: "dev",
            name: "Development",
            description: "Development environment",
            url: "http://localhost:3000",
            defaultUrl: "http://localhost:3000",
            requiresUrl: false,
            color: "#10b981",
            icon: "code"
          },
          staging: {
            id: "staging",
            name: "Staging",
            description: "Staging environment for testing",
            url: "https://staging.example.com",
            defaultUrl: "https://staging.example.com",
            requiresUrl: false,
            color: "#f59e0b",
            icon: "test-tube"
          },
          uat: {
            id: "uat",
            name: "UAT",
            description: "User Acceptance Testing environment",
            url: "https://uat.example.com",
            defaultUrl: "https://uat.example.com",
            requiresUrl: false,
            color: "#8b5cf6",
            icon: "users"
          },
          production: {
            id: "production",
            name: "Production",
            description: "Production environment",
            url: "https://example.com",
            defaultUrl: "https://example.com",
            requiresUrl: false,
            color: "#ef4444",
            icon: "globe"
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
    console.log('RunTestsCard: Loading environment configuration, projectPath:', projectPath);
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
              {environmentConfig?.environments?.[environment]?.isPlaywrightProject && (
                <Badge variant="outline" className="text-xs">
                  From Playwright Config
                </Badge>
              )}
            </Label>
            <Select 
              value={environmentConfig?.environments?.[environment] ? environment : 'custom'} 
              onValueChange={(value) => {
                try {
                  console.log('Environment changed to:', value);
                  console.log('Current environment config:', environmentConfig);
                  // Validate that the environment exists in the config
                  if (environmentConfig?.environments?.[value] || value === 'custom') {
                    handleEnvironmentChange(value);
                  } else {
                    console.warn('Invalid environment selected:', value, 'Available environments:', Object.keys(environmentConfig?.environments || {}));
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
            {/* URL Configuration Section */}
            <div className="mt-2 space-y-2">
              <Label className="flex items-center gap-2 text-sm font-medium">
                <Globe className="w-4 h-4" />
                Website URL
              </Label>
              
              {environment === 'custom' ? (
                <div className="flex gap-2">
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
              ) : isLoadingEnvironments ? (
                <div className="text-sm text-muted-foreground">
                  Loading environment configuration...
                </div>
              ) : environment && environmentConfig?.environments?.[environment] ? (
                <div className="space-y-2">
                  {editingUrls[environment] !== undefined ? (
                    // Editing mode
                    <div className="flex gap-2">
                      <Input
                        type="url"
                        value={editingUrls[environment]}
                        onChange={(e) => handleUrlEdit(environment, e.target.value)}
                        placeholder="https://example.com"
                        className="flex-1"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        onClick={() => handleUrlSave(environment)}
                        disabled={isSavingUrl}
                        title="Save URL"
                      >
                        <Check className="w-4 h-4" />
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        onClick={() => handleUrlCancel(environment)}
                        disabled={isSavingUrl}
                        title="Cancel"
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  ) : (
                    // Display mode
                    <div className="flex items-center gap-2 p-2 border rounded-md bg-muted/50">
                      <span className="flex-1 text-sm text-muted-foreground">
                        {environmentConfig.environments[environment].url || 'No URL configured'}
                      </span>
                      {environmentConfig.environments[environment].isPlaywrightProject && (
                        <Badge variant="outline" className="text-xs">
                          Playwright Config
                        </Badge>
                      )}
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          console.log('Edit button clicked for environment:', environment);
                          console.log('Environment config:', environmentConfig?.environments?.[environment]);
                          console.log('All environments:', environmentConfig?.environments ? Object.keys(environmentConfig.environments) : 'none');
                          handleUrlEdit(environment, environmentConfig.environments[environment].url || '');
                        }}
                        title={environmentConfig.environments[environment].isPlaywrightProject 
                          ? "Edit URL in Playwright Config" 
                          : "Edit URL"}
                        className="h-6 w-6"
                        disabled={!environmentConfig?.environments?.[environment]}
                      >
                        <Edit2 className="w-3 h-3" />
                      </Button>
                    </div>
                  )}
                  <p className="text-xs text-muted-foreground">
                    {environmentConfig.environments[environment].description}
                  </p>
                </div>
              ) : null}
            </div>
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