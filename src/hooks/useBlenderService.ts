import { useState, useEffect, useCallback } from 'react';
import { blenderService } from '../services/BlenderService';
import { useElectron } from './useElectron';

export const useBlenderService = () => {
  const [isBlenderAvailable, setIsBlenderAvailable] = useState(false);
  const [blenderVersion, setBlenderVersion] = useState('');
  const [blenderPath, setBlenderPath] = useState('');
  const [isChecking, setIsChecking] = useState(true);
  const { electronAPI } = useElectron();

  const checkBlenderAvailability = useCallback(async () => {
    if (!electronAPI) {
      setIsChecking(false);
      return;
    }

    setIsChecking(true);
    try {
      // Configure the blender service with the Electron API
      blenderService.setElectronAPI(electronAPI);
      
      const available = await blenderService.isBlenderAvailable();
      setIsBlenderAvailable(available);
      
      if (available) {
        const version = await blenderService.getBlenderVersion();
        setBlenderVersion(version);
        const path = await blenderService.getBlenderPath();
        setBlenderPath(path);
      }
    } catch (error) {
      console.error('Error checking Blender availability:', error);
      setIsBlenderAvailable(false);
    } finally {
      setIsChecking(false);
    }
  }, [electronAPI]);

  const updateBlenderPath = useCallback(async (newPath: string) => {
    if (!electronAPI) return;
    
    await blenderService.setBlenderPath(newPath);
    await checkBlenderAvailability();
  }, [electronAPI, checkBlenderAvailability]);

  useEffect(() => {
    if (electronAPI) {
      checkBlenderAvailability();
    }
  }, [electronAPI, checkBlenderAvailability]);

  return {
    isBlenderAvailable,
    blenderVersion,
    blenderPath,
    isChecking,
    checkBlenderAvailability,
    updateBlenderPath,
    blenderService
  };
};