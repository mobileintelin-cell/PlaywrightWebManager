import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Checkbox } from "./ui/checkbox";
import { ScrollArea } from "./ui/scroll-area";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "./ui/dialog";
import { Play, Globe, User, Lock, FileText, HelpCircle, Download } from "lucide-react";

interface RunTestsCardProps {
  onRunTests: (config: TestRunConfig) => void;
  isRunning: boolean;
  testFiles: string[];
}

export interface TestRunConfig {
  selectedTestFiles: string[];
  username: string;
  password: string;
  websiteUrl: string;
  environment: string;
}

export function RunTestsCard({ onRunTests, isRunning, testFiles }: RunTestsCardProps) {
  const [selectedTestFiles, setSelectedTestFiles] = useState<string[]>([]);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [environment, setEnvironment] = useState('');
  const [showHelpDialog, setShowHelpDialog] = useState(false);
  const [customUrl, setCustomUrl] = useState('');


  const environmentUrls = {
    dev: 'https://dev.example.com',
    staging: 'https://staging.example.com',
    uat: 'https://uat.example.com',
    production: 'https://example.com'
  };

  const getWebsiteUrl = () => {
    if (environment === 'custom') {
      return customUrl;
    }
    return environmentUrls[environment as keyof typeof environmentUrls] || '';
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
    onRunTests({
      selectedTestFiles,
      username,
      password,
      websiteUrl: getWebsiteUrl(),
      environment
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
            <Select value={environment} onValueChange={setEnvironment}>
              <SelectTrigger>
                <SelectValue placeholder="Select environment" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="custom">Custom</SelectItem>
                <SelectItem value="dev">Dev</SelectItem>
                <SelectItem value="staging">Staging</SelectItem>
                <SelectItem value="uat">UAT</SelectItem>
                <SelectItem value="production">Production</SelectItem>
              </SelectContent>
            </Select>
            {environment === 'custom' && (
              <div className="mt-2 flex gap-2">
                <Input
                  id="custom-url"
                  type="url"
                  value={customUrl}
                  onChange={(e) => setCustomUrl(e.target.value)}
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
            {environment && environment !== 'custom' && (
              <div className="text-sm text-muted-foreground mt-1">
                {environmentUrls[environment as keyof typeof environmentUrls]}
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
              onChange={(e) => setUsername(e.target.value)}
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
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter password"
            />
          </div>
        </div>

        {/* Test Files Section */}
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
        
        <Button 
          onClick={handleRun} 
          disabled={isRunning || selectedTestFiles.length === 0 || !environment || (environment === 'custom' && !customUrl)}
          className="w-full"
        >
          <Play className="w-4 h-4 mr-2" />
          {isRunning ? 'Running...' : `Run ${selectedTestFiles.length} Test${selectedTestFiles.length !== 1 ? 's' : ''}`}
        </Button>
        
        {isRunning && (
          <p className="text-sm text-muted-foreground mt-2">
            Runs are queued if one is in progress.
          </p>
        )}
        
        {selectedTestFiles.length === 0 && (
          <p className="text-sm text-muted-foreground">
            Please select at least one test file to run.
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