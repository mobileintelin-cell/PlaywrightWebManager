import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { ScrollArea } from "./ui/scroll-area";
import { Badge } from "./ui/badge";
import { FileText, CheckCircle, XCircle, Clock } from "lucide-react";

interface QuickActionsCardProps {
  onOpenTestFile: (filename: string) => void;
  testFiles: string[];
  testResults: Record<string, 'passed' | 'failed' | 'pending'>;
}

export function QuickActionsCard({ 
  onOpenTestFile, 
  testFiles,
  testResults
}: QuickActionsCardProps) {
  return (
    <Card className="h-fit">
      <CardHeader>
        <CardTitle>Test Files</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label className="text-sm font-medium">Test Files</Label>
          <ScrollArea className="h-64 border rounded-md">
            <div className="p-2 space-y-1">
              {testFiles.map((file, index) => {
                const status = testResults[file] || 'pending';
                const getStatusIcon = () => {
                  switch (status) {
                    case 'passed':
                      return <CheckCircle className="w-4 h-4 text-green-600" />;
                    case 'failed':
                      return <XCircle className="w-4 h-4 text-red-600" />;
                    default:
                      return <Clock className="w-4 h-4 text-muted-foreground" />;
                  }
                };
                
                const getStatusBadge = () => {
                  switch (status) {
                    case 'passed':
                      return <Badge className="bg-green-100 text-green-800 hover:bg-green-100 text-xs">Passed</Badge>;
                    case 'failed':
                      return <Badge variant="destructive" className="text-xs">Failed</Badge>;
                    default:
                      return <Badge variant="secondary" className="text-xs">Pending</Badge>;
                  }
                };

                return (
                  <button
                    key={index}
                    onClick={() => onOpenTestFile(file)}
                    className="w-full text-left text-sm p-2 rounded hover:bg-accent flex items-center justify-between transition-colors group"
                  >
                    <div className="flex items-center min-w-0 flex-1">
                      <FileText className="w-4 h-4 mr-2 text-muted-foreground flex-shrink-0" />
                      <span className="truncate">{file}</span>
                    </div>
                    <div className="flex items-center gap-2 ml-2">
                      {getStatusIcon()}
                      {getStatusBadge()}
                    </div>
                  </button>
                );
              })}
            </div>
          </ScrollArea>
        </div>
      </CardContent>
    </Card>
  );
}

function Label({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={className}>{children}</div>;
}