import { contextBridge, ipcRenderer } from 'electron';

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  // File system operations
  selectBlendFiles: () => ipcRenderer.invoke('select-blend-files'),
  selectOutputDirectory: () => ipcRenderer.invoke('select-output-directory'),
  showSaveDialog: (options) => ipcRenderer.invoke('show-save-dialog', options),
  showOpenDialog: (options) => ipcRenderer.invoke('show-open-dialog', options),
  showMessageBox: (options) => ipcRenderer.invoke('show-message-box', options),
  
  // External operations
  openExternal: (url) => ipcRenderer.invoke('open-external', url),
  showItemInFolder: (path) => ipcRenderer.invoke('show-item-in-folder', path),
  
  // App info
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),
  getPlatform: () => ipcRenderer.invoke('get-platform'),
  
  // Menu actions
  onMenuAction: (callback) => {
    ipcRenderer.on('menu-action', (event, action, data) => {
      callback(action, data);
    });
  },
  
  // Remove menu action listener
  removeMenuActionListener: () => {
    ipcRenderer.removeAllListeners('menu-action');
  },

  // Blender operations
  blender: {
    isBlenderAvailable: () => ipcRenderer.invoke('blender-is-available'),
    getBlenderVersion: () => ipcRenderer.invoke('blender-get-version'),
    setBlenderPath: (path) => ipcRenderer.invoke('blender-set-path', path),
    getBlenderPath: () => ipcRenderer.invoke('blender-get-path'),
    renderFile: (options, onProgress) => {
      const progressId = `progress-${Date.now()}-${Math.random()}`;
      
      if (onProgress) {
        const progressHandler = (event, id, progress) => {
          if (id === progressId) {
            onProgress(progress);
          }
        };
        
        ipcRenderer.on('blender-progress', progressHandler);
        
        // Clean up listener when render completes
        const cleanup = () => {
          ipcRenderer.removeListener('blender-progress', progressHandler);
        };
        
        return ipcRenderer.invoke('blender-render-file', options, progressId)
          .finally(cleanup);
      }
      
      return ipcRenderer.invoke('blender-render-file', options, progressId);
    },
    cancelRender: (blendFile) => ipcRenderer.invoke('blender-cancel-render', blendFile),
    cancelAllRenders: () => ipcRenderer.invoke('blender-cancel-all-renders'),
    getActiveRenders: () => ipcRenderer.invoke('blender-get-active-renders'),
    isRenderActive: (blendFile) => ipcRenderer.invoke('blender-is-render-active', blendFile)
  }
});

// Expose a limited API for drag and drop
contextBridge.exposeInMainWorld('dragDropAPI', {
  onFileDrop: (callback) => {
    document.addEventListener('drop', (e) => {
      e.preventDefault();
      const files = Array.from(e.dataTransfer.files).map(file => file.path);
      callback(files);
    });
    
    document.addEventListener('dragover', (e) => {
      e.preventDefault();
    });
  }
});