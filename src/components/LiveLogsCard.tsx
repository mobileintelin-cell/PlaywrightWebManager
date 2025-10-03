import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { ScrollArea } from "./ui/scroll-area";
import { Button } from "./ui/button";
import { Terminal, ArrowDown, Maximize2, Minimize2 } from "lucide-react";

interface LiveLogsCardProps {
  logs: string[];
}

export function LiveLogsCard({ logs }: LiveLogsCardProps) {
  const scrollAreaRef = useRef(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const [showScrollButton, setShowScrollButton] = useState(false);
  const [isAutoScroll, setIsAutoScroll] = useState(true);

  // Auto-scroll to bottom whenever logs change and auto-scroll is enabled
  useEffect(() => {
    if (isAutoScroll && logs.length > 0) {
      // Use multiple timing strategies to ensure scrolling works
      const scrollToBottomNow = () => {
        if (scrollAreaRef.current) {
          const scrollElement = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]') as HTMLElement;
          if (scrollElement) {
            scrollElement.scrollTop = scrollElement.scrollHeight;
          }
        }
      };

      // Immediate scroll
      scrollToBottomNow();
      
      // Delayed scroll to catch any DOM updates
      const timer1 = setTimeout(scrollToBottomNow, 10);
      const timer2 = setTimeout(scrollToBottomNow, 50);
      
      return () => {
        clearTimeout(timer1);
        clearTimeout(timer2);
      };
    }
  }, [logs, isAutoScroll]);

  // Additional effect specifically for when log entries increase
  useEffect(() => {
    if (logs.length > 0 && isAutoScroll) {
      // Force scroll when new entries are added
      const timer = setTimeout(() => {
        forceScrollToBottom();
        console.log(`Auto-scrolling to bottom - ${logs.length} log entries`);
      }, 20);
      return () => clearTimeout(timer);
    }
  }, [logs.length]);

  // Check if user has scrolled up (to show scroll-to-bottom button)
  const handleScroll = (event: any) => {
    const target = event.target as HTMLElement;
    const scrollElement = target.querySelector('[data-radix-scroll-area-viewport]') as HTMLElement;
    
    if (scrollElement) {
      const { scrollTop, scrollHeight, clientHeight } = scrollElement;
      const isAtBottom = scrollTop + clientHeight >= scrollHeight - 10; // 10px threshold
      
      setShowScrollButton(!isAtBottom);
      setIsAutoScroll(isAtBottom);
    }
  };

  const scrollToBottom = () => {
    if (scrollAreaRef.current) {
      const scrollElement = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]') as HTMLElement;
      if (scrollElement) {
        scrollElement.scrollTop = scrollElement.scrollHeight;
        setIsAutoScroll(true);
        setShowScrollButton(false);
      }
    }
  };

  // Force scroll to bottom - can be called externally
  const forceScrollToBottom = () => {
    if (scrollAreaRef.current) {
      const scrollElement = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]') as HTMLElement;
      if (scrollElement) {
        // Use multiple approaches to ensure scrolling works
        scrollElement.scrollTop = scrollElement.scrollHeight;
        scrollElement.scrollTo({
          top: scrollElement.scrollHeight,
          behavior: 'auto'
        });
        setIsAutoScroll(true);
        setShowScrollButton(false);
      }
    }
  };

  return (
    <Card className="col-span-full">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center">
            <Terminal className="w-5 h-5 mr-2" />
            Live Logs
            {logs.length > 0 && (
              <span className="ml-2 text-sm text-muted-foreground">
                ({logs.length} entries)
              </span>
            )}
          </CardTitle>
          <div className="flex items-center gap-2">
            {showScrollButton && (
              <Button
                variant="outline"
                size="sm"
                onClick={scrollToBottom}
                className="flex items-center gap-1"
              >
                <ArrowDown className="w-4 h-4" />
                Scroll to Bottom
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsExpanded(!isExpanded)}
              className="flex items-center gap-1"
            >
              {isExpanded ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
              {isExpanded ? 'Collapse' : 'Expand'}
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="relative">
          <ScrollArea 
            className={`w-full rounded border bg-slate-950 p-4 ${isExpanded ? 'h-96' : 'h-64'}`}
            ref={scrollAreaRef}
            onScrollCapture={handleScroll}
          >
            <div className="space-y-1 font-mono text-sm">
              {logs.length === 0 ? (
                <div className="text-slate-400">No logs yet. Run tests to see output...</div>
              ) : (
                logs.map((log, index) => {
                  // Determine log type based on content
                  const logLower = log.toLowerCase();
                  const isSuccess = logLower.includes('passed') || logLower.includes('success') || logLower.includes('✓');
                  const isError = logLower.includes('error') || logLower.includes('✗');
                  const isWarning = logLower.includes('warning') || logLower.includes('warn');
                  const isResults = logLower.includes('results:') || logLower.includes('passed,') || logLower.includes('failed,') || logLower.includes('skipped');
                  const isRunning = logLower.includes('running') || logLower.includes('starting') || logLower.includes('executing');
                  
                  // Use inline styles for reliable color rendering
                  let logStyle: { color: string } = { color: '#ffffff' }; // Default white
                  if (isError) logStyle = { color: '#ef4444' }; // Red
                  else if (isSuccess) logStyle = { color: '#22c55e' }; // Green
                  else if (isWarning) logStyle = { color: '#eab308' }; // Yellow
                  else if (isRunning) logStyle = { color: '#22c55e' }; // Green for running
                  else if (isResults) logStyle = { color: '#22c55e' }; // Green for results
                 
                  return (
                    <div key={index} className="flex items-start gap-2">
                      <span className="text-slate-300 text-xs mt-0.5 flex-shrink-0">
                        {new Date().toLocaleTimeString()}
                      </span>
                      <span className="flex-1 break-words" style={logStyle}>{log}</span>
                    </div>
                  );
                })
              )}
            </div>
          </ScrollArea>
          
          {/* Auto-scroll indicator */}
          {isAutoScroll && logs.length > 0 && (
            <div className="absolute bottom-2 right-2 text-xs text-slate-500 bg-slate-800 px-2 py-1 rounded">
              Auto-scrolling
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}