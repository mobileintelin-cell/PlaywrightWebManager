import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Switch } from './ui/switch';
import { Settings, Plus, Edit, Trash2, Save, X, Globe, Code, TestTube, Users } from 'lucide-react';

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

interface EnvironmentManagerProps {
  onEnvironmentChange?: () => void;
}

export function EnvironmentManager({ onEnvironmentChange }: EnvironmentManagerProps) {
  const [environmentConfig, setEnvironmentConfig] = useState<EnvironmentConfig | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [editingEnvironment, setEditingEnvironment] = useState<Environment | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  // Fetch environment configuration
  const fetchEnvironmentConfig = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('http://localhost:3001/api/environments');
      if (response.ok) {
        const data = await response.json();
        setEnvironmentConfig(data);
      }
    } catch (error) {
      console.error('Error fetching environment config:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Save environment configuration
  const saveEnvironmentConfig = async () => {
    if (!environmentConfig) return;
    
    setIsSaving(true);
    try {
      const response = await fetch('http://localhost:3001/api/environments', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(environmentConfig),
      });
      
      if (response.ok) {
        onEnvironmentChange?.();
      }
    } catch (error) {
      console.error('Error saving environment config:', error);
    } finally {
      setIsSaving(false);
    }
  };

  // Update specific environment
  const updateEnvironment = async (envId: string, updates: Partial<Environment>) => {
    if (!environmentConfig) return;
    
    setIsSaving(true);
    try {
      const response = await fetch(`http://localhost:3001/api/environments/${envId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updates),
      });
      
      if (response.ok) {
        await fetchEnvironmentConfig();
        onEnvironmentChange?.();
      }
    } catch (error) {
      console.error('Error updating environment:', error);
    } finally {
      setIsSaving(false);
    }
  };

  // Load environment configuration on component mount
  useEffect(() => {
    fetchEnvironmentConfig();
  }, []);

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

  const handleEditEnvironment = (env: Environment) => {
    setEditingEnvironment({ ...env });
    setIsCreating(false);
    setShowEditDialog(true);
  };

  const handleCreateEnvironment = () => {
    setEditingEnvironment({
      id: '',
      name: '',
      description: '',
      url: '',
      defaultUrl: '',
      requiresUrl: true,
      color: '#6b7280',
      icon: 'globe'
    });
    setIsCreating(true);
    setShowEditDialog(true);
  };

  const handleSaveEnvironment = () => {
    if (!editingEnvironment || !environmentConfig) return;
    
    if (isCreating) {
      // Create new environment
      const newEnv = { ...editingEnvironment };
      if (!newEnv.id) {
        newEnv.id = newEnv.name.toLowerCase().replace(/\s+/g, '-');
      }
      
      setEnvironmentConfig({
        ...environmentConfig,
        environments: {
          ...environmentConfig.environments,
          [newEnv.id]: newEnv
        }
      });
    } else {
      // Update existing environment
      updateEnvironment(editingEnvironment.id, editingEnvironment);
    }
    
    setShowEditDialog(false);
    setEditingEnvironment(null);
  };

  const handleDeleteEnvironment = (envId: string) => {
    if (!environmentConfig || envId === 'custom') return; // Don't delete custom environment
    
    const newEnvironments = { ...environmentConfig.environments };
    delete newEnvironments[envId];
    
    setEnvironmentConfig({
      ...environmentConfig,
      environments: newEnvironments
    });
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Environment Configuration</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-4">Loading environments...</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Environment Configuration</CardTitle>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleCreateEnvironment}
              className="flex items-center gap-1"
            >
              <Plus className="w-4 h-4" />
              Add Environment
            </Button>
            <Button
              onClick={saveEnvironmentConfig}
              disabled={isSaving}
              className="flex items-center gap-1"
            >
              <Save className="w-4 h-4" />
              {isSaving ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {environmentConfig && (
          <>
            {/* Default Environment */}
            <div className="space-y-2">
              <Label>Default Environment</Label>
              <Select
                value={environmentConfig.defaultEnvironment}
                onValueChange={(value) => setEnvironmentConfig({
                  ...environmentConfig,
                  defaultEnvironment: value
                })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(environmentConfig.environments).map(([envId, env]) => (
                    <SelectItem key={envId} value={envId}>
                      <div className="flex items-center gap-2">
                        {React.createElement(getEnvironmentIcon(env.icon), { 
                          className: "w-4 h-4", 
                          style: { color: env.color } 
                        })}
                        <span>{env.name}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Environment List */}
            <div className="space-y-3">
              <Label>Environments</Label>
              {Object.entries(environmentConfig.environments).map(([envId, env]) => (
                <div key={envId} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center gap-3">
                    {React.createElement(getEnvironmentIcon(env.icon), { 
                      className: "w-5 h-5", 
                      style: { color: env.color } 
                    })}
                    <div>
                      <div className="font-medium">{env.name}</div>
                      <div className="text-sm text-muted-foreground">{env.description}</div>
                      <div className="text-xs text-muted-foreground">{env.url || 'Custom URL'}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleEditEnvironment(env)}
                    >
                      <Edit className="w-4 h-4" />
                    </Button>
                    {envId !== 'custom' && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDeleteEnvironment(envId)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Error Context Settings */}
            <div className="space-y-3 pt-4 border-t">
              <Label>Error Context Settings</Label>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="captureScreenshots" className="text-sm">Capture Screenshots</Label>
                  <Switch
                    id="captureScreenshots"
                    checked={environmentConfig.errorContext.captureScreenshots}
                    onCheckedChange={(checked) => setEnvironmentConfig({
                      ...environmentConfig,
                      errorContext: {
                        ...environmentConfig.errorContext,
                        captureScreenshots: checked
                      }
                    })}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label htmlFor="captureVideos" className="text-sm">Capture Videos</Label>
                  <Switch
                    id="captureVideos"
                    checked={environmentConfig.errorContext.captureVideos}
                    onCheckedChange={(checked) => setEnvironmentConfig({
                      ...environmentConfig,
                      errorContext: {
                        ...environmentConfig.errorContext,
                        captureVideos: checked
                      }
                    })}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label htmlFor="captureTraces" className="text-sm">Capture Traces</Label>
                  <Switch
                    id="captureTraces"
                    checked={environmentConfig.errorContext.captureTraces}
                    onCheckedChange={(checked) => setEnvironmentConfig({
                      ...environmentConfig,
                      errorContext: {
                        ...environmentConfig.errorContext,
                        captureTraces: checked
                      }
                    })}
                  />
                </div>
              </div>
            </div>
          </>
        )}

        {/* Edit Environment Dialog */}
        <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>
                {isCreating ? 'Create Environment' : 'Edit Environment'}
              </DialogTitle>
            </DialogHeader>
            {editingEnvironment && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="env-name">Name</Label>
                  <Input
                    id="env-name"
                    value={editingEnvironment.name}
                    onChange={(e) => setEditingEnvironment({
                      ...editingEnvironment,
                      name: e.target.value
                    })}
                    placeholder="Environment name"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="env-description">Description</Label>
                  <Input
                    id="env-description"
                    value={editingEnvironment.description}
                    onChange={(e) => setEditingEnvironment({
                      ...editingEnvironment,
                      description: e.target.value
                    })}
                    placeholder="Environment description"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="env-url">URL</Label>
                  <Input
                    id="env-url"
                    value={editingEnvironment.url}
                    onChange={(e) => setEditingEnvironment({
                      ...editingEnvironment,
                      url: e.target.value
                    })}
                    placeholder="https://example.com"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="env-color">Color</Label>
                  <Input
                    id="env-color"
                    type="color"
                    value={editingEnvironment.color}
                    onChange={(e) => setEditingEnvironment({
                      ...editingEnvironment,
                      color: e.target.value
                    })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="env-icon">Icon</Label>
                  <Select
                    value={editingEnvironment.icon}
                    onValueChange={(value) => setEditingEnvironment({
                      ...editingEnvironment,
                      icon: value
                    })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="globe">Globe</SelectItem>
                      <SelectItem value="code">Code</SelectItem>
                      <SelectItem value="test-tube">Test Tube</SelectItem>
                      <SelectItem value="users">Users</SelectItem>
                      <SelectItem value="settings">Settings</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center justify-between">
                  <Label htmlFor="env-requires-url" className="text-sm">Requires Custom URL</Label>
                  <Switch
                    id="env-requires-url"
                    checked={editingEnvironment.requiresUrl}
                    onCheckedChange={(checked) => setEditingEnvironment({
                      ...editingEnvironment,
                      requiresUrl: checked
                    })}
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setShowEditDialog(false)}>
                    <X className="w-4 h-4 mr-1" />
                    Cancel
                  </Button>
                  <Button onClick={handleSaveEnvironment}>
                    <Save className="w-4 h-4 mr-1" />
                    Save
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
