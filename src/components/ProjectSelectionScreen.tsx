import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Badge } from "./ui/badge";
import { Textarea } from "./ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "./ui/dialog";
import { Folder, Search, RefreshCw, ArrowRight, Play, FileText, Wifi, WifiOff, AlertCircle, Plus, Loader2 } from "lucide-react";

interface ProjectSelectionScreenProps {
  onProjectSelect: (project: string) => void;
}

interface ProjectFolder {
  name: string;
  path: string;
  testCount: number;
  lastModified: string;
  description: string;
  status: 'active' | 'archived' | 'new';
  cachedTestStatus?: {
    passed: number;
    failed: number;
    skipped: number;
    lastRun: string;
    environment: string;
  };
}

export function ProjectSelectionScreen({ onProjectSelect }: ProjectSelectionScreenProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [projects, setProjects] = useState<ProjectFolder[]>([]);
  const [serverConnected, setServerConnected] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isCreatingProject, setIsCreatingProject] = useState(false);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [newProjectDescription, setNewProjectDescription] = useState('');

  const fetchProjects = async (query: string = '') => {
    setIsLoading(true);
    setError(null);
    try {
      const url = query 
        ? `http://localhost:3001/api/projects/search?q=${encodeURIComponent(query)}`
        : 'http://localhost:3001/api/projects';
      
      const response = await fetch(url);
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      
      // Fetch cached test status for each project
      const projectsWithCache = await Promise.all(
        data.map(async (project: ProjectFolder) => {
          try {
            const cacheResponse = await fetch(`http://localhost:3001/api/projects/${project.name}/test-status`);
            if (cacheResponse.ok) {
              const cacheData = await cacheResponse.json();
              if (cacheData.hasCache) {
                return {
                  ...project,
                  cachedTestStatus: {
                    passed: cacheData.cachedRun.passed,
                    failed: cacheData.cachedRun.failed,
                    skipped: cacheData.cachedRun.skipped,
                    lastRun: cacheData.cachedRun.cachedAt,
                    environment: cacheData.cachedRun.environment
                  }
                };
              }
            }
          } catch (error) {
            console.error(`Error fetching cache for ${project.name}:`, error);
          }
          return project;
        })
      );
      
      setProjects(projectsWithCache);
      setServerConnected(true);
    } catch (error) {
      console.error('Error fetching projects:', error);
      setServerConnected(false);
      setError(error instanceof Error ? error.message : 'Failed to connect to server');
    
    } finally {
      setIsLoading(false);
    }
  };

  const handleSearch = () => {
    fetchProjects(searchQuery);
  };

  const handleRefresh = () => {
    fetchProjects(searchQuery);
  };

  const handleCreateProject = async () => {
    if (!newProjectName.trim()) return;
    
    setIsCreatingProject(true);
    try {
      const response = await fetch('http://localhost:3001/api/projects/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: newProjectName.trim(),
          description: newProjectDescription.trim() || undefined
        })
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      
      // Add the new project to the list
      setProjects(prev => [data.project, ...prev]);
      
      // Close dialog and reset form
      setShowCreateDialog(false);
      setNewProjectName('');
      setNewProjectDescription('');
      
      // Navigate to the new project
      onProjectSelect(data.project.name);
      
    } catch (error) {
      console.error('Error creating project:', error);
      setError(error instanceof Error ? error.message : 'Failed to create project');
    } finally {
      setIsCreatingProject(false);
    }
  };

  useEffect(() => {
    // Load initial projects
    fetchProjects('');
  }, []);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <Badge className="bg-green-100 text-green-800 hover:bg-green-100">Active</Badge>;
      case 'archived':
        return <Badge variant="secondary">Archived</Badge>;
      case 'new':
        return <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100">New</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card">
        <div className="container mx-auto px-6 py-6">
          <div className="text-center">
            <h1 className="text-3xl font-semibold mb-2">Playwright Web Manager</h1>
            <p className="text-muted-foreground">Select a project to start running automation tests</p>
            <div className="flex items-center justify-center gap-2 mt-3">
              {serverConnected ? (
                <div className="flex items-center gap-1 text-green-600">
                  <Wifi className="w-4 h-4" />
                  <span className="text-sm">Connected to server</span>
                </div>
              ) : (
                <div className="flex items-center gap-1 text-orange-600">
                  <WifiOff className="w-4 h-4" />
                  <span className="text-sm">Using offline mode</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-6 py-8 max-w-4xl">
        {/* Error Display */}
        {error && (
          <Card className="mb-6 border-orange-200 bg-orange-50">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-orange-800">
                <AlertCircle className="w-5 h-5" />
                <div>
                  <p className="font-medium">Server Connection Issue</p>
                  <p className="text-sm text-orange-700">{error}</p>
                  <p className="text-xs text-orange-600 mt-1">
                    Showing sample projects. Start the server with: <code className="bg-orange-100 px-1 rounded">npm run server</code>
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Search Section */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center">
              <Search className="w-5 h-5 mr-2" />
              Find Your Project
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-3">
              <div className="flex-1">
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search by project name or description..."
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                  className="text-base"
                />
              </div>
              <Button 
                onClick={handleSearch} 
                disabled={isLoading}
                variant="outline"
              >
                <Search className="w-4 h-4 mr-2" />
                Search
              </Button>
              <Button 
                onClick={handleRefresh} 
                disabled={isLoading}
                variant="outline"
              >
                <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Projects Grid */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">Available Projects</h2>
            <div className="flex items-center gap-3">
              <span className="text-sm text-muted-foreground">
                {isLoading ? 'Loading...' : `${projects.length} projects found`}
              </span>
              <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm" className="gap-2">
                    <Plus className="w-4 h-4" />
                    New Project
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[425px]">
                  <DialogHeader>
                    <DialogTitle>Create New Playwright Project</DialogTitle>
                  </DialogHeader>
                  <div className="grid gap-4 py-4">
                    <div className="grid gap-2">
                      <Label htmlFor="project-name">Project Name</Label>
                      <Input
                        id="project-name"
                        value={newProjectName}
                        onChange={(e) => setNewProjectName(e.target.value)}
                        placeholder="my-playwright-project"
                        onKeyDown={(e) => e.key === 'Enter' && handleCreateProject()}
                      />
                      <p className="text-xs text-muted-foreground">
                        Project name will be converted to lowercase with hyphens
                      </p>
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="project-description">Description (Optional)</Label>
                      <Textarea
                        id="project-description"
                        value={newProjectDescription}
                        onChange={(e) => setNewProjectDescription(e.target.value)}
                        placeholder="Describe your test project..."
                        rows={3}
                      />
                    </div>
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button 
                      variant="outline" 
                      onClick={() => setShowCreateDialog(false)}
                      disabled={isCreatingProject}
                    >
                      Cancel
                    </Button>
                    <Button 
                      onClick={handleCreateProject}
                      disabled={!newProjectName.trim() || isCreatingProject}
                      className="gap-2"
                    >
                      {isCreatingProject ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Creating...
                        </>
                      ) : (
                        <>
                          <Plus className="w-4 h-4" />
                          Create Project
                        </>
                      )}
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <RefreshCw className="w-6 h-6 animate-spin mr-3" />
              <span className="text-muted-foreground">Querying server for projects...</span>
            </div>
          ) : projects.length === 0 ? (
            <Card>
              <CardContent className="text-center py-12">
                <Folder className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium mb-2">No Projects Found</h3>
                <p className="text-muted-foreground mb-6">
                  {searchQuery ? 
                    'No projects match your search criteria. Try adjusting your search terms.' :
                    'No Playwright projects found in your directory. Create a new project to get started.'
                  }
                </p>
                {!searchQuery && (
                  <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
                    <DialogTrigger asChild>
                      <Button className="gap-2">
                        <Plus className="w-4 h-4" />
                        Create Test Project
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-[425px]">
                      <DialogHeader>
                        <DialogTitle>Create New Playwright Project</DialogTitle>
                      </DialogHeader>
                      <div className="grid gap-4 py-4">
                        <div className="grid gap-2">
                          <Label htmlFor="project-name">Project Name</Label>
                          <Input
                            id="project-name"
                            value={newProjectName}
                            onChange={(e) => setNewProjectName(e.target.value)}
                            placeholder="my-playwright-project"
                            onKeyDown={(e) => e.key === 'Enter' && handleCreateProject()}
                          />
                          <p className="text-xs text-muted-foreground">
                            Project name will be converted to lowercase with hyphens
                          </p>
                        </div>
                        <div className="grid gap-2">
                          <Label htmlFor="project-description">Description (Optional)</Label>
                          <Textarea
                            id="project-description"
                            value={newProjectDescription}
                            onChange={(e) => setNewProjectDescription(e.target.value)}
                            placeholder="Describe your test project..."
                            rows={3}
                          />
                        </div>
                      </div>
                      <div className="flex justify-end gap-2">
                        <Button 
                          variant="outline" 
                          onClick={() => setShowCreateDialog(false)}
                          disabled={isCreatingProject}
                        >
                          Cancel
                        </Button>
                        <Button 
                          onClick={handleCreateProject}
                          disabled={!newProjectName.trim() || isCreatingProject}
                          className="gap-2"
                        >
                          {isCreatingProject ? (
                            <>
                              <Loader2 className="w-4 h-4 animate-spin" />
                              Creating...
                            </>
                          ) : (
                            <>
                              <Plus className="w-4 h-4" />
                              Create Project
                            </>
                          )}
                        </Button>
                      </div>
                    </DialogContent>
                  </Dialog>
                )}
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4">
              {projects.map((project) => (
                <Card 
                  key={project.path}
                  className="hover:shadow-md transition-shadow cursor-pointer group"
                  onClick={() => onProjectSelect(project.name)}
                >
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <Folder className="w-5 h-5 text-muted-foreground" />
                          <h3 className="text-lg font-semibold group-hover:text-primary transition-colors">
                            {project.name}
                          </h3>
                          {getStatusBadge(project.status)}
                        </div>
                        
                        <p className="text-muted-foreground mb-3 leading-relaxed">
                          {project.description}
                        </p>
                        
                        <div className="flex items-center gap-6 text-sm text-muted-foreground">
                          <div className="flex items-center gap-1">
                            <FileText className="w-4 h-4" />
                            <span>{project.testCount} tests</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <span>Updated {project.lastModified}</span>
                          </div>
                          {project.cachedTestStatus && (
                            <div className="flex items-center gap-1">
                              <span className="text-xs px-2 py-1 bg-green-100 text-green-800 rounded">
                                Last run: {new Date(project.cachedTestStatus.lastRun).toLocaleDateString()}
                              </span>
                              <span className="text-xs px-2 py-1 bg-blue-100 text-blue-800 rounded">
                                {project.cachedTestStatus.passed}✓ {project.cachedTestStatus.failed}✗
                              </span>
                              <span className="text-xs px-2 py-1 bg-gray-100 text-gray-800 rounded">
                                {project.cachedTestStatus.environment}
                              </span>
                            </div>
                          )}
                          <div className="flex items-center gap-1">
                            <span className="text-xs px-2 py-1 bg-muted rounded">
                              {project.path}
                            </span>
                          </div>
                        </div>
                      </div>
                      
                      <Button 
                        className="ml-4 group-hover:bg-primary group-hover:text-primary-foreground transition-colors"
                        variant="outline"
                        onClick={(e) => {
                          e.stopPropagation();
                          onProjectSelect(project.name);
                        }}
                      >
                        <Play className="w-4 h-4 mr-2" />
                        Select Project
                        <ArrowRight className="w-4 h-4 ml-2" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>

        {/* Footer Info */}
        <div className="mt-12 text-center text-sm text-muted-foreground">
          <p>Select a project above to access the test dashboard and start running automation tests.</p>
        </div>
      </main>
    </div>
  );
}