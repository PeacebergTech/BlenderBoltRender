import { useEffect } from 'react';
import { useElectron } from '../hooks/useElectron';

interface ElectronMenuHandlerProps {
  onNewProject: () => void;
  onOpenProject: (filePath: string) => void;
  onSaveProject: () => void;
  onSaveProjectAs: (filePath: string) => void;
  onAddBlendFiles: (filePaths: string[]) => void;
  onClearQueue: () => void;
  onStartRender: () => void;
  onStopRender: () => void;
  onPauseResume: () => void;
  onOpenOutputFolder: () => void;
}

export const ElectronMenuHandler: React.FC<ElectronMenuHandlerProps> = ({
  onNewProject,
  onOpenProject,
  onSaveProject,
  onSaveProjectAs,
  onAddBlendFiles,
  onClearQueue,
  onStartRender,
  onStopRender,
  onPauseResume,
  onOpenOutputFolder
}) => {
  const { electronAPI } = useElectron();

  useEffect(() => {
    if (!electronAPI) return;

    const handleMenuAction = (action: string, data?: any) => {
      switch (action) {
        case 'new-project':
          onNewProject();
          break;
        case 'open-project':
          onOpenProject(data);
          break;
        case 'save-project':
          onSaveProject();
          break;
        case 'save-project-as':
          onSaveProjectAs(data);
          break;
        case 'add-blend-files':
          onAddBlendFiles(data);
          break;
        case 'clear-queue':
          onClearQueue();
          break;
        case 'start-render':
          onStartRender();
          break;
        case 'stop-render':
          onStopRender();
          break;
        case 'pause-resume':
          onPauseResume();
          break;
        case 'open-output-folder':
          onOpenOutputFolder();
          break;
        default:
          console.log('Unknown menu action:', action);
      }
    };

    electronAPI.onMenuAction(handleMenuAction);

    return () => {
      electronAPI.removeMenuActionListener();
    };
  }, [
    electronAPI,
    onNewProject,
    onOpenProject,
    onSaveProject,
    onSaveProjectAs,
    onAddBlendFiles,
    onClearQueue,
    onStartRender,
    onStopRender,
    onPauseResume,
    onOpenOutputFolder
  ]);

  return null; // This component doesn't render anything
};