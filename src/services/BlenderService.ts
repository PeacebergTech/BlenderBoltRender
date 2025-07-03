import { BlenderRenderOptions, RenderProgress } from '../types/blender';

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

export class BlenderService implements BlenderAPI {
  private electronAPI: any;

  constructor(electronAPI?: any) {
    this.electronAPI = electronAPI;
  }

  setElectronAPI(electronAPI: any) {
    this.electronAPI = electronAPI;
  }

  async isBlenderAvailable(): Promise<boolean> {
    if (!this.electronAPI?.blender) {
      console.warn('Electron API not available');
      return false;
    }
    return this.electronAPI.blender.isBlenderAvailable();
  }

  async getBlenderVersion(): Promise<string> {
    if (!this.electronAPI?.blender) {
      throw new Error('Electron API not available');
    }
    return this.electronAPI.blender.getBlenderVersion();
  }

  async setBlenderPath(path: string): Promise<void> {
    if (!this.electronAPI?.blender) {
      throw new Error('Electron API not available');
    }
    return this.electronAPI.blender.setBlenderPath(path);
  }

  async getBlenderPath(): Promise<string> {
    if (!this.electronAPI?.blender) {
      throw new Error('Electron API not available');
    }
    return this.electronAPI.blender.getBlenderPath();
  }

  async renderFile(
    options: BlenderRenderOptions,
    onProgress?: (progress: RenderProgress) => void
  ): Promise<void> {
    if (!this.electronAPI?.blender) {
      throw new Error('Electron API not available');
    }
    return this.electronAPI.blender.renderFile(options, onProgress);
  }

  async cancelRender(blendFile: string): Promise<void> {
    if (!this.electronAPI?.blender) {
      throw new Error('Electron API not available');
    }
    return this.electronAPI.blender.cancelRender(blendFile);
  }

  async cancelAllRenders(): Promise<void> {
    if (!this.electronAPI?.blender) {
      throw new Error('Electron API not available');
    }
    return this.electronAPI.blender.cancelAllRenders();
  }

  async getActiveRenders(): Promise<string[]> {
    if (!this.electronAPI?.blender) {
      throw new Error('Electron API not available');
    }
    return this.electronAPI.blender.getActiveRenders();
  }

  async isRenderActive(blendFile: string): Promise<boolean> {
    if (!this.electronAPI?.blender) {
      throw new Error('Electron API not available');
    }
    return this.electronAPI.blender.isRenderActive(blendFile);
  }
}

// Create a singleton instance that will be configured with the Electron API
export const blenderService = new BlenderService();