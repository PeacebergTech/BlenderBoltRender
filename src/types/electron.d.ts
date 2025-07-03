export interface ElectronAPI {
  selectBlendFiles: () => Promise<string[]>;
  selectOutputDirectory: () => Promise<string | null>;
  showSaveDialog: (options: any) => Promise<any>;
  showOpenDialog: (options: any) => Promise<any>;
  showMessageBox: (options: any) => Promise<any>;
  openExternal: (url: string) => Promise<void>;
  showItemInFolder: (path: string) => Promise<void>;
  getAppVersion: () => Promise<string>;
  getPlatform: () => Promise<string>;
  onMenuAction: (callback: (action: string, data?: any) => void) => void;
  removeMenuActionListener: () => void;
}

export interface DragDropAPI {
  onFileDrop: (callback: (files: string[]) => void) => void;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
    dragDropAPI: DragDropAPI;
  }
}