import { useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { ScrollArea } from "./ui/scroll-area";
import { Terminal } from "lucide-react";

interface LiveLogsCardProps {
  logs: string[];
}

export function LiveLogsCard({ logs }: LiveLogsCardProps) {
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Auto-scroll to bottom when new logs are added
    if (scrollAreaRef.current) {
      scrollAreaRef.current.scrollTop = scrollAreaRef.current.scrollHeight;
    }
  }, [logs]);

  return (
    <Card className="col-span-full">
      <CardHeader>
        <CardTitle className="flex items-center">
          <Terminal className="w-5 h-5 mr-2" />
          Live Logs
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ScrollArea 
          className="h-64 w-full rounded border bg-slate-950 p-4"
          ref={scrollAreaRef}
        >
          <div className="space-y-1 font-mono text-sm">
            {logs.length === 0 ? (
              <div className="text-slate-400">No logs yet. Run tests to see output...</div>
            ) : (
              logs.map((log, index) => (
                <div key={index} className="text-green-400">
                  <span className="text-slate-500 mr-2">
                    {new Date().toLocaleTimeString()}
                  </span>
                  {log}
                </div>
              ))
            )}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}