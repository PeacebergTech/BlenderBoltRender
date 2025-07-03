import { useEffect, useState } from 'react';

export const useElectron = () => {
  const [isElectron, setIsElectron] = useState(false);
  const [appVersion, setAppVersion] = useState('');
  const [platform, setPlatform] = useState('');

  useEffect(() => {
    const checkElectron = async () => {
      if (window.electronAPI) {
        setIsElectron(true);
        try {
          const version = await window.electronAPI.getAppVersion();
          const platformInfo = await window.electronAPI.getPlatform();
          setAppVersion(version);
          setPlatform(platformInfo);
        } catch (error) {
          console.error('Error getting app info:', error);
        }
      }
    };

    checkElectron();
  }, []);

  return {
    isElectron,
    appVersion,
    platform,
    electronAPI: window.electronAPI,
    dragDropAPI: window.dragDropAPI
  };
};