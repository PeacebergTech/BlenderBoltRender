export const isElectron = (): boolean => {
  return typeof window !== 'undefined' && window.electronAPI !== undefined;
};

export const selectBlendFiles = async (): Promise<string[]> => {
  if (!isElectron()) {
    // Fallback for web version
    return new Promise((resolve) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.multiple = true;
      input.accept = '.blend';
      input.onchange = (e) => {
        const files = Array.from((e.target as HTMLInputElement).files || []);
        resolve(files.map(file => file.name)); // In web, we only get names
      };
      input.click();
    });
  }
  
  return window.electronAPI.selectBlendFiles();
};

export const selectOutputDirectory = async (): Promise<string | null> => {
  if (!isElectron()) {
    // Fallback for web version
    return prompt('Enter output directory path:');
  }
  
  return window.electronAPI.selectOutputDirectory();
};

export const showSaveDialog = async (options: any): Promise<any> => {
  if (!isElectron()) {
    // Fallback for web version
    const filename = prompt('Enter filename:');
    return { canceled: !filename, filePath: filename };
  }
  
  return window.electronAPI.showSaveDialog(options);
};

export const showOpenDialog = async (options: any): Promise<any> => {
  if (!isElectron()) {
    // Fallback for web version
    return new Promise((resolve) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = options.filters?.[0]?.extensions?.map((ext: string) => `.${ext}`).join(',') || '*';
      input.onchange = (e) => {
        const files = Array.from((e.target as HTMLInputElement).files || []);
        resolve({
          canceled: files.length === 0,
          filePaths: files.map(file => file.name)
        });
      };
      input.click();
    });
  }
  
  return window.electronAPI.showOpenDialog(options);
};

export const showMessageBox = async (options: any): Promise<any> => {
  if (!isElectron()) {
    // Fallback for web version
    const result = confirm(options.message);
    return { response: result ? 0 : 1 };
  }
  
  return window.electronAPI.showMessageBox(options);
};

export const openExternal = async (url: string): Promise<void> => {
  if (!isElectron()) {
    // Fallback for web version
    window.open(url, '_blank');
    return;
  }
  
  return window.electronAPI.openExternal(url);
};

export const showItemInFolder = async (path: string): Promise<void> => {
  if (!isElectron()) {
    // Fallback for web version
    console.log('Would open folder:', path);
    return;
  }
  
  return window.electronAPI.showItemInFolder(path);
};

export const getAppVersion = async (): Promise<string> => {
  if (!isElectron()) {
    return '1.0.0-web';
  }
  
  return window.electronAPI.getAppVersion();
};

export const getPlatform = async (): Promise<string> => {
  if (!isElectron()) {
    return 'web';
  }
  
  return window.electronAPI.getPlatform();
};