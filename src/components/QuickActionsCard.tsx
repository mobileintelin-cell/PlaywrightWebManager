import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { ScrollArea } from "./ui/scroll-area";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Checkbox } from "./ui/checkbox";
import { Label } from "./ui/label";
import { FileText, CheckCircle, XCircle, Clock, ChevronDown, ChevronRight } from "lucide-react";

interface IndividualTestCase {
  id: string;
  fileName: string;
  testName: string;
  filePath: string;
  selected: boolean;
  order: number;
}

interface QuickActionsCardProps {
  onOpenTestFile: (filename: string) => void;
  testFiles: string[];
  testResults: Record<string, 'passed' | 'failed' | 'pending'>;
  individualTestCases?: IndividualTestCase[];
  onIndividualTestCaseToggle?: (testId: string) => void;
  onToggleAllIndividualTests?: (selectAll: boolean) => void;
}

export function QuickActionsCard({ 
  onOpenTestFile, 
  testFiles,
  testResults,
  individualTestCases = [],
  onIndividualTestCaseToggle,
  onToggleAllIndividualTests
}: QuickActionsCardProps) {
  const [expandedFiles, setExpandedFiles] = useState(new Set<string>());
  const hasInitialized = useRef(false);

  // Helper functions
  const getTestsForFile = (filename: string) => {
    return individualTestCases.filter(test => test.fileName === filename);
  };

  const getSelectedTestFiles = () => {
    const filesWithSelectedTests = new Set(
      individualTestCases
        .filter(test => test.selected)
        .map(test => test.fileName)
    );
    return Array.from(filesWithSelectedTests);
  };

  const getSelectedTestsForFile = (filename: string) => {
    return individualTestCases.filter(test => test.fileName === filename && test.selected);
  };

  const isFileFullySelected = (filename: string) => {
    const fileTests = getTestsForFile(filename);
    return fileTests.length > 0 && fileTests.every(test => test.selected);
  };

  const isFilePartiallySelected = (filename: string) => {
    const fileTests = getTestsForFile(filename);
    const selectedTests = getSelectedTestsForFile(filename);
    return selectedTests.length > 0 && selectedTests.length < fileTests.length;
  };

  const handleTestFileToggle = (filename: string, checked: boolean) => {
    const fileTests = individualTestCases.filter(test => test.fileName === filename);
    
    if (checked) {
      // Auto-select all individual tests in this file
      fileTests.forEach(test => {
        if (!test.selected) {
          onIndividualTestCaseToggle?.(test.id);
        }
      });
    } else {
      // Auto-deselect all individual tests in this file
      fileTests.forEach(test => {
        if (test.selected) {
          onIndividualTestCaseToggle?.(test.id);
        }
      });
    }
  };

  const toggleFileExpansion = (filename: string) => {
    setExpandedFiles(prev => {
      const newSet = new Set(prev);
      if (newSet.has(filename)) {
        newSet.delete(filename);
      } else {
        newSet.add(filename);
      }
      return newSet;
    });
  };

  const handleSelectAll = () => {
    const selectedTestFiles = getSelectedTestFiles();
    const allFilesHaveSelectedTests = testFiles.every(file => {
      const fileTests = getTestsForFile(file);
      return fileTests.length > 0 && fileTests.every(test => test.selected);
    });
    
    if (allFilesHaveSelectedTests) {
      // Deselect all individual tests
      individualTestCases.forEach(test => {
        if (test.selected) {
          onIndividualTestCaseToggle?.(test.id);
        }
      });
    } else {
      // Select all individual tests
      individualTestCases.forEach(test => {
        if (!test.selected) {
          onIndividualTestCaseToggle?.(test.id);
        }
      });
    }
  };

  // Auto-expand files that have individual tests and auto-select all tests by default
  useEffect(() => {
    if (individualTestCases.length > 0 && !hasInitialized.current) {
      // Auto-expand files that have individual tests
      const filesWithTests = new Set(individualTestCases.map(test => test.fileName));
      setExpandedFiles(filesWithTests);
      
      // Auto-select all individual tests by default (only on initial load)
      individualTestCases.forEach(test => {
        if (!test.selected) {
          onIndividualTestCaseToggle?.(test.id);
        }
      });
      
      hasInitialized.current = true;
    }
  }, [individualTestCases.length, onIndividualTestCaseToggle]);

  const selectedTestFiles = getSelectedTestFiles();
  const isAllSelected = testFiles.every(file => {
    const fileTests = getTestsForFile(file);
    return fileTests.length === 0 || fileTests.every(test => test.selected);
  });
  const isSomeSelected = selectedTestFiles.length > 0 && !isAllSelected;

  return (
    <Card className="h-fit">
      <CardHeader>
        <CardTitle>Test Files</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-sm font-medium">Test Files ({selectedTestFiles.length}/{testFiles.length})</Label>
            <Button
              variant="outline"
              size="sm"
              onClick={handleSelectAll}
              className="text-xs"
            >
              {isAllSelected ? 'Deselect All' : 'Select All'}
            </Button>
          </div>
          
          <ScrollArea className="h-64 border rounded-md p-2">
            <div className="space-y-1">
              {testFiles.map((file) => {
                const fileTests = getTestsForFile(file);
                const selectedTests = getSelectedTestsForFile(file);
                const isExpanded = expandedFiles.has(file);
                const isFullySelected = isFileFullySelected(file);
                const isPartiallySelected = isFilePartiallySelected(file);
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
                  <div key={file} className="space-y-1">
                    {/* Test File Row */}
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id={file}
                        checked={isFullySelected}
                        ref={(el) => {
                          if (el) {
                            el.indeterminate = isPartiallySelected && !isFullySelected;
                          }
                        }}
                        onCheckedChange={(checked) => handleTestFileToggle(file, checked as boolean)}
                      />
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => toggleFileExpansion(file)}
                        className="p-1 h-auto hover:bg-muted"
                        disabled={fileTests.length === 0}
                      >
                        {fileTests.length > 0 ? (
                          isExpanded ? (
                            <ChevronDown className="w-4 h-4" />
                          ) : (
                            <ChevronRight className="w-4 h-4" />
                          )
                        ) : null}
                      </Button>
                      <button
                        onClick={() => onOpenTestFile(file)}
                        className="flex items-center justify-between flex-1 text-left hover:bg-accent rounded p-1 transition-colors group"
                      >
                        <div className="flex items-center min-w-0 flex-1">
                          <FileText className="w-4 h-4 mr-2 text-muted-foreground flex-shrink-0" />
                          <span className="truncate text-sm">{file}</span>
                          {fileTests.length > 0 && (
                            <span className="text-xs text-muted-foreground ml-2">
                              ({selectedTests.length}/{fileTests.length} tests)
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 ml-2">
                          {getStatusIcon()}
                          {getStatusBadge()}
                        </div>
                      </button>
                    </div>
                    
                    {/* Individual Tests (when expanded) */}
                    {isExpanded && fileTests.length > 0 && (
                      <div className="ml-6 space-y-1">
                        {fileTests.map((testCase) => (
                          <div key={testCase.id} className="flex items-center space-x-2">
                            <Checkbox
                              id={testCase.id}
                              checked={testCase.selected}
                              onCheckedChange={() => onIndividualTestCaseToggle?.(testCase.id)}
                            />
                            <Label 
                              htmlFor={testCase.id} 
                              className="text-sm cursor-pointer flex-1 leading-relaxed"
                            >
                              <span className="text-muted-foreground">{testCase.testName}</span>
                            </Label>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        </div>
      </CardContent>
    </Card>
  );
}