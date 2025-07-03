import { useState, useEffect, useCallback } from 'react';
import { blenderService } from '../services/BlenderService';

export const useBlenderService = () => {
  const [isBlenderAvailable, setIsBlenderAvailable] = useState(false);
  const [blenderVersion, setBlenderVersion] = useState('');
  const [blenderPath, setBlenderPath] = useState('');
  const [isChecking, setIsChecking] = useState(true);

  const checkBlenderAvailability = useCallback(async () => {
    setIsChecking(true);
    try {
      const available = await blenderService.isBlenderAvailable();
      setIsBlenderAvailable(available);
      
      if (available) {
        const version = await blenderService.getBlenderVersion();
        setBlenderVersion(version);
        setBlenderPath(blenderService.getBlenderPath());
      }
    } catch (error) {
      console.error('Error checking Blender availability:', error);
      setIsBlenderAvailable(false);
    } finally {
      setIsChecking(false);
    }
  }, []);

  const updateBlenderPath = useCallback(async (newPath: string) => {
    blenderService.setBlenderPath(newPath);
    await checkBlenderAvailability();
  }, [checkBlenderAvailability]);

  useEffect(() => {
    checkBlenderAvailability();
  }, [checkBlenderAvailability]);

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