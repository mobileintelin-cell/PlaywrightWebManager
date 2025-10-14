import React, { useState, useEffect } from 'react';
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { Badge } from "./ui/badge";
import { Separator } from "./ui/separator";
import { Alert, AlertDescription } from "./ui/alert";
import { 
  Settings, 
  Save, 
  RefreshCw, 
  AlertCircle, 
  CheckCircle, 
  ExternalLink,
  FileText,
  Globe,
  Code
} from "lucide-react";
import { getApiUrl } from '../config/api';

interface PlaywrightConfigEditorProps {
  selectedProject: string;
  onConfigUpdate?: () => void;
}

interface PlaywrightConfig {
  content: string;
  baseURLs: {
    default?: string;
    [key: string]: string | undefined;
  };
  projects: Array<{
    name: string;
    baseURL: string | null;
    use: string;
  }>;
}

interface PlaywrightConfigData {
  success: boolean;
  configPath: string;
  config: PlaywrightConfig;
}

export function PlaywrightConfigEditor({ selectedProject, onConfigUpdate }: PlaywrightConfigEditorProps) {
  const [configData, setConfigData] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [editedBaseURLs, setEditedBaseURLs] = useState({});
  const [editedProjects, setEditedProjects] = useState([]);
  const [defaultUrl, setDefaultUrl] = useState('');

  // Load Playwright config
  const loadConfig = async () => {
    setIsLoading(true);
    setError(null);
    setSuccess(null);
    
    try {
      const response = await fetch(getApiUrl(`/projects/${selectedProject}/playwright-config`));
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      setConfigData(data);
      
      // Initialize edited values
      setEditedBaseURLs(data.config.baseURLs || {});
      setEditedProjects(data.config.projects.map((p: any) => ({
        name: p.name,
        baseURL: p.baseURL || ''
      })));
      
      // Set default URL from the default baseURL
      setDefaultUrl(data.config.baseURLs?.default || '');
      
    } catch (error) {
      console.error('Error loading Playwright config:', error);
      setError(error instanceof Error ? error.message : 'Failed to load Playwright config');
    } finally {
      setIsLoading(false);
    }
  };

  // Save Playwright config
  const saveConfig = async () => {
    if (!configData) return;
    
    setIsSaving(true);
    setError(null);
    setSuccess(null);
    
    try {
      const response = await fetch(getApiUrl(`/projects/${selectedProject}/playwright-config`), {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          configPath: configData.configPath,
          baseURLs: editedBaseURLs,
          projects: editedProjects
        })
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
      }
      
      const result = await response.json();
      setSuccess(result.message || 'Playwright config updated successfully');
      
      // Reload config to get updated values
      await loadConfig();
      
      // Notify parent component
      if (onConfigUpdate) {
        onConfigUpdate();
      }
      
    } catch (error) {
      console.error('Error saving Playwright config:', error);
      setError(error instanceof Error ? error.message : 'Failed to save Playwright config');
    } finally {
      setIsSaving(false);
    }
  };

  // Load config on component mount
  useEffect(() => {
    loadConfig();
  }, [selectedProject]);

  // Handle baseURL changes
  const handleBaseURLChange = (key: string, value: string) => {
    setEditedBaseURLs(prev => ({
      ...prev,
      [key]: value
    }));
  };

  // Handle default URL change
  const handleDefaultUrlChange = (value: string) => {
    setDefaultUrl(value);
    // Also update the default baseURL
    setEditedBaseURLs(prev => ({
      ...prev,
      default: value
    }));
  };

  // Handle project baseURL changes
  const handleProjectBaseURLChange = (projectName: string, value: string) => {
    setEditedProjects(prev => 
      prev.map(p => 
        p.name === projectName 
          ? { ...p, baseURL: value }
          : p
      )
    );
  };

  // Apply default URL to all projects
  const applyDefaultToAllProjects = () => {
    if (defaultUrl) {
      setEditedProjects(prev => 
        prev.map(p => ({ ...p, baseURL: defaultUrl }))
      );
    }
  };

  // Reset to original values
  const resetChanges = () => {
    if (configData) {
      setEditedBaseURLs(configData.config.baseURLs || {});
      setEditedProjects(configData.config.projects.map((p: any) => ({
        name: p.name,
        baseURL: p.baseURL || ''
      })));
      setDefaultUrl(configData.config.baseURLs?.default || '');
    }
  };

  // Check if there are unsaved changes
  const hasChanges = () => {
    if (!configData) return false;
    
    // Check default URL
    if (configData.config.baseURLs?.default !== defaultUrl) return true;
    
    // Check baseURLs
    const originalBaseURLs = configData.config.baseURLs || {};
    for (const [key, value] of Object.entries(editedBaseURLs)) {
      if (originalBaseURLs[key] !== value) return true;
    }
    
    // Check projects
    for (const editedProject of editedProjects) {
      const originalProject = configData.config.projects.find(p => p.name === editedProject.name);
      if (originalProject && originalProject.baseURL !== editedProject.baseURL) {
        return true;
      }
    }
    
    return false;
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="w-5 h-5" />
            Playwright Configuration
          </CardTitle>
          <CardDescription>
            Loading Playwright configuration...
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <RefreshCw className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="w-5 h-5" />
            Playwright Configuration
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              {error}
            </AlertDescription>
          </Alert>
          <Button onClick={loadConfig} className="mt-4" variant="outline">
            <RefreshCw className="w-4 h-4 mr-2" />
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (!configData) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Settings className="w-5 h-5" />
              Playwright Configuration
            </CardTitle>
            <CardDescription className="flex items-center gap-2 mt-1">
              <FileText className="w-4 h-4" />
              {configData.configPath}
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Button onClick={loadConfig} variant="outline" size="sm">
              <RefreshCw className="w-4 h-4 mr-2" />
              Reload
            </Button>
            <Button 
              onClick={saveConfig} 
              disabled={!hasChanges() || isSaving}
              size="sm"
            >
              {isSaving ? (
                <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Save className="w-4 h-4 mr-2" />
              )}
              Save Changes
            </Button>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-6">
        {success && (
          <Alert>
            <CheckCircle className="h-4 w-4" />
            <AlertDescription>
              {success}
            </AlertDescription>
          </Alert>
        )}

        {hasChanges() && (
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              You have unsaved changes. Click "Save Changes" to apply them.
            </AlertDescription>
          </Alert>
        )}

        {/* Default URL Section */}
        <div className="space-y-4 p-4 bg-muted/50 rounded-lg border">
          <div className="flex items-center justify-between">
            <Label className="flex items-center gap-2 text-base font-semibold">
              <Globe className="w-5 h-5" />
              Default URL
            </Label>
            <Badge variant="outline" className="text-xs">
              Global Setting
            </Badge>
          </div>
          
          <div className="space-y-2">
            <Input
              value={defaultUrl}
              onChange={(e) => handleDefaultUrlChange(e.target.value)}
              placeholder="https://example.com"
              className="font-mono text-sm"
            />
            <p className="text-xs text-muted-foreground">
              This URL will be used as the default baseURL for all Playwright tests. 
              It's set in the global 'use' configuration and can be overridden by project-specific settings.
            </p>
          </div>
          
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleDefaultUrlChange('https://web-backoffice-south-hn.hr.stg.intelin.vn')}
              className="text-xs"
            >
              Set Staging URL
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleDefaultUrlChange('http://localhost:3000')}
              className="text-xs"
            >
              Set Local URL
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleDefaultUrlChange('https://example.com')}
              className="text-xs"
            >
              Set Example URL
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleDefaultUrlChange('process.env.LOCAL')}
              className="text-xs"
            >
              Set Env Variable
            </Button>
          </div>
        </div>

        <Separator />

        {/* Project BaseURLs */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label className="flex items-center gap-2">
                <Code className="w-4 h-4" />
                Project BaseURLs
              </Label>
              <p className="text-sm text-muted-foreground">
                Configure baseURLs for each Playwright project environment.
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={applyDefaultToAllProjects}
              disabled={!defaultUrl}
              className="text-xs"
            >
              Apply Default to All
            </Button>
          </div>
          
          {editedProjects.map((project) => (
            <div key={project.name} className="space-y-2">
              <div className="flex items-center gap-2">
                <Badge variant="secondary">{project.name}</Badge>
                <Label className="text-sm font-medium">BaseURL</Label>
                {project.baseURL && project.baseURL.startsWith('process.env.') && (
                  <Badge variant="outline" className="text-xs">
                    Environment Variable
                  </Badge>
                )}
              </div>
              <Input
                value={project.baseURL}
                onChange={(e) => handleProjectBaseURLChange(project.name, e.target.value)}
                placeholder="https://example.com or process.env.LOCAL"
                className="font-mono text-sm"
              />
              {project.baseURL && project.baseURL.startsWith('process.env.') && (
                <p className="text-xs text-muted-foreground">
                  This uses an environment variable. Make sure the variable is set when running tests.
                </p>
              )}
            </div>
          ))}
        </div>

        {hasChanges() && (
          <div className="flex items-center gap-2 pt-4">
            <Button onClick={resetChanges} variant="outline" size="sm">
              Reset Changes
            </Button>
          </div>
        )}

        {/* Config Preview */}
        <div className="space-y-2">
          <Label className="flex items-center gap-2">
            <FileText className="w-4 h-4" />
            Configuration Preview
          </Label>
          <div className="bg-muted p-4 rounded-lg">
            <pre className="text-xs font-mono overflow-x-auto">
              <code>{configData.config.content}</code>
            </pre>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
