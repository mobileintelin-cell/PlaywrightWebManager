import { useState } from 'react';
import { ProjectSelectionScreen } from "./components/ProjectSelectionScreen";
import { TestDashboard } from "./components/TestDashboard";

type AppScreen = 'project-selection' | 'test-dashboard';

export default function App() {
  const [currentScreen, setCurrentScreen] = useState<AppScreen>('project-selection');
  const [selectedProject, setSelectedProject] = useState<string | null>(null);
  const [selectedProjectPath, setSelectedProjectPath] = useState<string | null>(null);

  const handleProjectSelect = (projectName: string, projectPath?: string) => {
    setSelectedProject(projectName);
    setSelectedProjectPath(projectPath || null);
    setCurrentScreen('test-dashboard');
  };

  const handleBackToProjectSelection = () => {
    setCurrentScreen('project-selection');
    setSelectedProject(null);
    setSelectedProjectPath(null);
  };

  if (currentScreen === 'project-selection') {
    return <ProjectSelectionScreen onProjectSelect={handleProjectSelect} />;
  }

  if (currentScreen === 'test-dashboard' && selectedProject) {
    return (
      <TestDashboard 
        selectedProject={selectedProject}
        selectedProjectPath={selectedProjectPath}
        onBackToProjectSelection={handleBackToProjectSelection}
      />
    );
  }

  // Fallback - should never reach here
  return <ProjectSelectionScreen onProjectSelect={handleProjectSelect} />;
}