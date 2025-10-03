import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { Badge } from "./ui/badge";
import { Folder, Search, RefreshCw } from "lucide-react";

interface ProjectSelectorProps {
  selectedProject: string | null;
  onProjectSelect: (project: string) => void;
}

interface ProjectFolder {
  name: string;
  path: string;
  testCount: number;
  lastModified: string;
}

export function ProjectSelector({ selectedProject, onProjectSelect }: ProjectSelectorProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [projects, setProjects] = useState<ProjectFolder[]>([]);

  // Mock project folders that would come from server
  const mockProjects: ProjectFolder[] = [
    {
      name: 'e-commerce-frontend',
      path: '/projects/e-commerce-frontend',
      testCount: 45,
      lastModified: '2 hours ago'
    },
    {
      name: 'admin-dashboard',
      path: '/projects/admin-dashboard',
      testCount: 32,
      lastModified: '1 day ago'
    },
    {
      name: 'mobile-app-tests',
      path: '/projects/mobile-app-tests',
      testCount: 28,
      lastModified: '3 days ago'
    },
    {
      name: 'api-integration-tests',
      path: '/projects/api-integration-tests',
      testCount: 67,
      lastModified: '5 hours ago'
    },
    {
      name: 'user-portal',
      path: '/projects/user-portal',
      testCount: 23,
      lastModified: '1 week ago'
    },
    {
      name: 'payment-gateway',
      path: '/projects/payment-gateway',
      testCount: 19,
      lastModified: '2 days ago'
    }
  ];

  const simulateServerQuery = async (query: string) => {
    setIsLoading(true);
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 800));
    
    const filtered = mockProjects.filter(project =>
      project.name.toLowerCase().includes(query.toLowerCase()) ||
      project.path.toLowerCase().includes(query.toLowerCase())
    );
    
    setProjects(filtered);
    setIsLoading(false);
  };

  const handleSearch = () => {
    simulateServerQuery(searchQuery);
  };

  const handleRefresh = () => {
    simulateServerQuery(searchQuery);
  };

  useEffect(() => {
    // Load initial projects
    simulateServerQuery('');
  }, []);

  const filteredProjects = searchQuery 
    ? projects.filter(project =>
        project.name.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : projects;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center">
          <Folder className="w-5 h-5 mr-2" />
          Project Selection
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <div className="flex-1">
            <Label htmlFor="search-query">Search Projects</Label>
            <Input
              id="search-query"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Type to search project folders..."
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            />
          </div>
          <div className="flex gap-1 items-end">
            <Button 
              onClick={handleSearch} 
              disabled={isLoading}
              variant="outline"
              size="icon"
            >
              <Search className="w-4 h-4" />
            </Button>
            <Button 
              onClick={handleRefresh} 
              disabled={isLoading}
              variant="outline"
              size="icon"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </div>

        {selectedProject && (
          <div className="p-3 bg-primary/5 rounded-lg border">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Current Project</p>
                <p className="font-medium">{selectedProject}</p>
              </div>
              <Badge variant="secondary">Active</Badge>
            </div>
          </div>
        )}

        <div className="space-y-2">
          <Label>Available Projects ({filteredProjects.length})</Label>
          <div className="max-h-48 overflow-y-auto space-y-2">
            {isLoading ? (
              <div className="flex items-center justify-center py-8 text-muted-foreground">
                <RefreshCw className="w-4 h-4 animate-spin mr-2" />
                Querying server...
              </div>
            ) : filteredProjects.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No projects found matching your search.
              </div>
            ) : (
              filteredProjects.map((project) => (
                <div
                  key={project.path}
                  className={`p-3 border rounded-lg cursor-pointer transition-colors hover:bg-accent ${
                    selectedProject === project.name ? 'bg-primary/10 border-primary' : ''
                  }`}
                  onClick={() => onProjectSelect(project.name)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <h4 className="font-medium">{project.name}</h4>
                        {selectedProject === project.name && (
                          <Badge variant="default" className="text-xs">Selected</Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">{project.path}</p>
                      <div className="flex items-center gap-4 mt-1">
                        <span className="text-xs text-muted-foreground">
                          {project.testCount} tests
                        </span>
                        <span className="text-xs text-muted-foreground">
                          Updated {project.lastModified}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}