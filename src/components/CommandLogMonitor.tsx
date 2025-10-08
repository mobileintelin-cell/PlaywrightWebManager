import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Badge } from './ui/badge';
import { ScrollArea } from './ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Alert, AlertDescription } from './ui/alert';
import { getApiUrl } from '../config/api';
import { 
  Play, 
  Square, 
  Search, 
  Filter, 
  RefreshCw, 
  Trash2, 
  Clock, 
  CheckCircle, 
  XCircle, 
  AlertCircle,
  Terminal,
  Activity
} from 'lucide-react';

interface CommandLog {
  id: string;
  projectName: string;
  command: string;
  args: string[];
  environment: string;
  startTime: string;
  endTime?: string;
  status: 'running' | 'completed' | 'failed' | 'cancelled';
  exitCode?: number;
  duration: number;
  stdout: Array<{ data: string; timestamp: string; isError: boolean }>;
  stderr: Array<{ data: string; timestamp: string; isError: boolean }>;
  logs: Array<{ level: string; message: string; timestamp: string }>;
  processId?: number;
}

interface CommandLogMonitorProps {
  className?: string;
}

const CommandLogMonitor: React.FC<CommandLogMonitorProps> = ({ className }) => {
  const [commandLogs, setCommandLogs] = useState<CommandLog[]>([]);
  const [activeCommands, setActiveCommands] = useState<CommandLog[]>([]);
  const [selectedLog, setSelectedLog] = useState<CommandLog | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [projectFilter, setProjectFilter] = useState<string>('all');
  const [isConnected, setIsConnected] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);
  
  const wsRef = useRef<WebSocket | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // WebSocket connection
  useEffect(() => {
    const connectWebSocket = () => {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}`;
      
      wsRef.current = new WebSocket(wsUrl);
      
      wsRef.current.onopen = () => {
        console.log('WebSocket connected');
        setIsConnected(true);
      };
      
      wsRef.current.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          handleWebSocketMessage(message);
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
        }
      };
      
      wsRef.current.onclose = () => {
        console.log('WebSocket disconnected');
        setIsConnected(false);
        // Reconnect after 3 seconds
        setTimeout(connectWebSocket, 3000);
      };
      
      wsRef.current.onerror = (error) => {
        console.error('WebSocket error:', error);
        setIsConnected(false);
      };
    };
    
    connectWebSocket();
    
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, []);

  const handleWebSocketMessage = (message: any) => {
    switch (message.type) {
      case 'command_start':
        setActiveCommands(prev => [...prev, message.data]);
        setCommandLogs(prev => [message.data, ...prev]);
        break;
      case 'command_complete':
      case 'command_cancelled':
        setActiveCommands(prev => prev.filter(cmd => cmd.id !== message.data.id));
        setCommandLogs(prev => 
          prev.map(cmd => 
            cmd.id === message.data.id 
              ? { ...cmd, ...message.data }
              : cmd
          )
        );
        break;
      case 'log':
        setCommandLogs(prev => 
          prev.map(cmd => 
            cmd.id === message.data.id 
              ? { ...cmd, logs: [...cmd.logs, message.data] }
              : cmd
          )
        );
        setActiveCommands(prev => 
          prev.map(cmd => 
            cmd.id === message.data.id 
              ? { ...cmd, logs: [...cmd.logs, message.data] }
              : cmd
          )
        );
        break;
      case 'output':
        setCommandLogs(prev => 
          prev.map(cmd => 
            cmd.id === message.data.id 
              ? { 
                  ...cmd, 
                  stdout: message.data.isError ? cmd.stdout : [...cmd.stdout, message.data],
                  stderr: message.data.isError ? [...cmd.stderr, message.data] : cmd.stderr
                }
              : cmd
          )
        );
        setActiveCommands(prev => 
          prev.map(cmd => 
            cmd.id === message.data.id 
              ? { 
                  ...cmd, 
                  stdout: message.data.isError ? cmd.stdout : [...cmd.stdout, message.data],
                  stderr: message.data.isError ? [...cmd.stderr, message.data] : cmd.stderr
                }
              : cmd
          )
        );
        break;
      case 'active_commands':
        setActiveCommands(message.data);
        break;
    }
  };

  // Load initial data
  useEffect(() => {
    loadCommandLogs();
    loadActiveCommands();
  }, []);

  // Auto-refresh
  useEffect(() => {
    if (!autoRefresh) return;
    
    const interval = setInterval(() => {
      loadCommandLogs();
      loadActiveCommands();
    }, 5000);
    
    return () => clearInterval(interval);
  }, [autoRefresh]);

  const loadCommandLogs = async () => {
    try {
      const response = await fetch(getApiUrl('/command-logs?limit=100'));
      const data = await response.json();
      if (data.success) {
        setCommandLogs(data.logs);
      }
    } catch (error) {
      console.error('Error loading command logs:', error);
    }
  };

  const loadActiveCommands = async () => {
    try {
      const response = await fetch(getApiUrl('/command-logs/active'));
      const data = await response.json();
      if (data.success) {
        setActiveCommands(data.activeCommands);
      }
    } catch (error) {
      console.error('Error loading active commands:', error);
    }
  };

  const cancelCommand = async (commandId: string) => {
    try {
      const response = await fetch(`/api/command-logs/${commandId}/cancel`, {
        method: 'POST'
      });
      const data = await response.json();
      if (data.success) {
        console.log('Command cancelled:', commandId);
      }
    } catch (error) {
      console.error('Error cancelling command:', error);
    }
  };

  const clearLogs = async () => {
    try {
      const response = await fetch(getApiUrl('/command-logs'), {
        method: 'DELETE'
      });
      const data = await response.json();
      if (data.success) {
        setCommandLogs([]);
        setActiveCommands([]);
        setSelectedLog(null);
      }
    } catch (error) {
      console.error('Error clearing logs:', error);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'running':
        return <Activity className="h-4 w-4 text-blue-500 animate-pulse" />;
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'failed':
        return <XCircle className="h-4 w-4 text-red-500" />;
      case 'cancelled':
        return <AlertCircle className="h-4 w-4 text-yellow-500" />;
      default:
        return <Clock className="h-4 w-4 text-gray-500" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'running':
        return 'bg-blue-100 text-blue-800';
      case 'completed':
        return 'bg-green-100 text-green-800';
      case 'failed':
        return 'bg-red-100 text-red-800';
      case 'cancelled':
        return 'bg-yellow-100 text-yellow-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const formatDuration = (duration: number) => {
    if (duration < 1000) return `${duration}ms`;
    if (duration < 60000) return `${(duration / 1000).toFixed(1)}s`;
    return `${(duration / 60000).toFixed(1)}m`;
  };

  const formatTimestamp = (timestamp: string) => {
    return new Date(timestamp).toLocaleString();
  };

  const filteredLogs = commandLogs.filter(log => {
    const matchesSearch = !searchQuery || 
      log.command.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.projectName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.logs.some(logEntry => logEntry.message.toLowerCase().includes(searchQuery.toLowerCase()));
    
    const matchesStatus = statusFilter === 'all' || log.status === statusFilter;
    const matchesProject = projectFilter === 'all' || log.projectName === projectFilter;
    
    return matchesSearch && matchesStatus && matchesProject;
  });

  const uniqueProjects = Array.from(new Set(commandLogs.map(log => log.projectName)));

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Header */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Terminal className="h-5 w-5" />
              Command Log Monitor
              <Badge variant={isConnected ? "default" : "destructive"}>
                {isConnected ? 'Connected' : 'Disconnected'}
              </Badge>
            </CardTitle>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setAutoRefresh(!autoRefresh)}
              >
                <RefreshCw className={`h-4 w-4 ${autoRefresh ? 'animate-spin' : ''}`} />
                Auto-refresh
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={loadCommandLogs}
              >
                <RefreshCw className="h-4 w-4" />
                Refresh
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={clearLogs}
              >
                <Trash2 className="h-4 w-4" />
                Clear
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Active Commands */}
      {activeCommands.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5 text-blue-500" />
              Active Commands ({activeCommands.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {activeCommands.map((command) => (
                <div
                  key={command.id}
                  className="flex items-center justify-between p-3 border rounded-lg bg-blue-50"
                >
                  <div className="flex items-center gap-3">
                    {getStatusIcon(command.status)}
                    <div>
                      <div className="font-medium">{command.projectName}</div>
                      <div className="text-sm text-gray-600">
                        {command.command} {command.args.join(' ')}
                      </div>
                      <div className="text-xs text-gray-500">
                        Started: {formatTimestamp(command.startTime)}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge className={getStatusColor(command.status)}>
                      {command.status}
                    </Badge>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => cancelCommand(command.id)}
                    >
                      <Square className="h-4 w-4" />
                      Cancel
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Search className="h-4 w-4" />
              <Input
                placeholder="Search commands..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-64"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-32">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="running">Running</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="failed">Failed</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>
            <Select value={projectFilter} onValueChange={setProjectFilter}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Project" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Projects</SelectItem>
                {uniqueProjects.map((project) => (
                  <SelectItem key={project} value={project}>
                    {project}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Command Logs */}
      <Card>
        <CardHeader>
          <CardTitle>Command History ({filteredLogs.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="list" className="w-full">
            <TabsList>
              <TabsTrigger value="list">List View</TabsTrigger>
              <TabsTrigger value="details">Details</TabsTrigger>
            </TabsList>
            
            <TabsContent value="list" className="mt-4">
              <ScrollArea className="h-96">
                <div className="space-y-2">
                  {filteredLogs.map((log) => (
                    <div
                      key={log.id}
                      className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                        selectedLog?.id === log.id ? 'bg-blue-50 border-blue-200' : 'hover:bg-gray-50'
                      }`}
                      onClick={() => setSelectedLog(log)}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          {getStatusIcon(log.status)}
                          <div>
                            <div className="font-medium">{log.projectName}</div>
                            <div className="text-sm text-gray-600">
                              {log.command} {log.args.join(' ')}
                            </div>
                            <div className="text-xs text-gray-500">
                              {formatTimestamp(log.startTime)} • {formatDuration(log.duration)}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge className={getStatusColor(log.status)}>
                            {log.status}
                          </Badge>
                          {log.status === 'running' && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                cancelCommand(log.id);
                              }}
                            >
                              <Square className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </TabsContent>
            
            <TabsContent value="details" className="mt-4">
              {selectedLog ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <h4 className="font-medium mb-2">Command Details</h4>
                      <div className="space-y-1 text-sm">
                        <div><strong>Project:</strong> {selectedLog.projectName}</div>
                        <div><strong>Command:</strong> {selectedLog.command}</div>
                        <div><strong>Args:</strong> {selectedLog.args.join(' ')}</div>
                        <div><strong>Environment:</strong> {selectedLog.environment}</div>
                        <div><strong>Status:</strong> {selectedLog.status}</div>
                        <div><strong>Exit Code:</strong> {selectedLog.exitCode ?? 'N/A'}</div>
                        <div><strong>Duration:</strong> {formatDuration(selectedLog.duration)}</div>
                        <div><strong>Process ID:</strong> {selectedLog.processId ?? 'N/A'}</div>
                      </div>
                    </div>
                    <div>
                      <h4 className="font-medium mb-2">Timing</h4>
                      <div className="space-y-1 text-sm">
                        <div><strong>Start:</strong> {formatTimestamp(selectedLog.startTime)}</div>
                        <div><strong>End:</strong> {selectedLog.endTime ? formatTimestamp(selectedLog.endTime) : 'Running...'}</div>
                      </div>
                    </div>
                  </div>
                  
                  <div>
                    <h4 className="font-medium mb-2">Logs</h4>
                    <ScrollArea className="h-48 border rounded p-3 bg-gray-50">
                      <div className="space-y-1 text-sm font-mono">
                        {selectedLog.logs.map((logEntry, index) => (
                          <div key={index} className="flex gap-2">
                            <span className="text-gray-500">
                              {new Date(logEntry.timestamp).toLocaleTimeString()}
                            </span>
                            <span className={`${
                              logEntry.level === 'error' ? 'text-red-600' :
                              logEntry.level === 'warn' ? 'text-yellow-600' :
                              logEntry.level === 'success' ? 'text-green-600' :
                              'text-gray-800'
                            }`}>
                              [{logEntry.level.toUpperCase()}]
                            </span>
                            <span>{logEntry.message}</span>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  </div>
                  
                  <div>
                    <h4 className="font-medium mb-2">Output</h4>
                    <ScrollArea className="h-48 border rounded p-3 bg-black text-green-400 font-mono text-sm">
                      <div className="space-y-1">
                        {selectedLog.stdout.map((output, index) => (
                          <div key={index}>
                            <span className="text-gray-500">
                              {new Date(output.timestamp).toLocaleTimeString()}
                            </span>
                            <span className="ml-2">{output.data}</span>
                          </div>
                        ))}
                        {selectedLog.stderr.map((output, index) => (
                          <div key={`error-${index}`} className="text-red-400">
                            <span className="text-gray-500">
                              {new Date(output.timestamp).toLocaleTimeString()}
                            </span>
                            <span className="ml-2">{output.data}</span>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  </div>
                </div>
              ) : (
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    Select a command from the list to view details.
                  </AlertDescription>
                </Alert>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
};

export default CommandLogMonitor;
