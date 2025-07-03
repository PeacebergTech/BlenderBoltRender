import { useEffect } from 'react';
import { useElectron } from '../hooks/useElectron';

interface DragDropHandlerProps {
  onFilesDropped: (files: string[]) => void;
}

export const DragDropHandler: React.FC<DragDropHandlerProps> = ({ onFilesDropped }) => {
  const { dragDropAPI } = useElectron();

  useEffect(() => {
    if (!dragDropAPI) return;

    const handleFileDrop = (files: string[]) => {
      // Filter for .blend files
      const blendFiles = files.filter(file => file.toLowerCase().endsWith('.blend'));
      if (blendFiles.length > 0) {
        onFilesDropped(blendFiles);
      }
    };

    dragDropAPI.onFileDrop(handleFileDrop);
  }, [dragDropAPI, onFilesDropped]);

  return null; // This component doesn't render anything
};