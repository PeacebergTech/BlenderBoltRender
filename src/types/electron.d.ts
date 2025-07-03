import { BlenderRenderOptions, RenderProgress } from './blender';

export interface BlenderAPI {
  isBlenderAvailable(): Promise<boolean>;
  getBlenderVersion(): Promise<string>;
  setBlenderPath(path: string): Promise<void>;
  getBlenderPath(): Promise<string>;
  renderFile(options: BlenderRenderOptions, onProgress?: (progress: RenderProgress) => void): Promise<void>;
  cancelRender(blendFile: string): Promise<void>;
  cancelAllRenders(): Promise<void>;
  getActiveRenders(): Promise<string[]>;
  isRenderActive(blendFile: string): Promise<boolean>;
}

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
  blender: BlenderAPI;
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