import { contextBridge, ipcRenderer } from 'electron';

// Define the API interface
export interface ElectronAPI {
  // File operations
  selectBlendFiles: () => Promise<void>;
  selectOutputDirectory: () => Promise<string | null>;
  openOutputFolder: (outputPath: string) => Promise<void>;

  // Blender operations
  checkBlender: () => Promise<string | null>;

  // Render job operations
  createRenderJob: (jobData: {
    blendFile: string;
    outputPath: string;
    startFrame: number;
    endFrame: number;
  }) => Promise<string>;
  startRenderQueue: () => Promise<void>;
  stopAllRenders: () => Promise<void>;
  clearCompletedJobs: () => Promise<void>;
  getAllJobs: () => Promise<any[]>;
  cancelJob: (jobId: string) => Promise<void>;
  removeJob: (jobId: string) => Promise<void>;

  // Event listeners
  onBlendFilesSelected: (callback: (filePaths: string[]) => void) => void;
  onRenderJobCreated: (callback: (job: any) => void) => void;
  onRenderJobUpdated: (callback: (job: any) => void) => void;
  onJobsCleared: (callback: (jobIds: string[]) => void) => void;
  onJobRemoved: (callback: (jobId: string) => void) => void;
  onMenuAction: (callback: (action: string) => void) => void;

  // Remove listeners
  removeAllListeners: (channel: string) => void;
}

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
const electronAPI: ElectronAPI = {
  // File operations
  selectBlendFiles: () => ipcRenderer.invoke('select-blend-files'),
  selectOutputDirectory: () => ipcRenderer.invoke('select-output-directory'),
  openOutputFolder: (outputPath: string) => ipcRenderer.invoke('open-output-folder', outputPath),

  // Blender operations
  checkBlender: () => ipcRenderer.invoke('check-blender'),

  // Render job operations
  createRenderJob: (jobData) => ipcRenderer.invoke('create-render-job', jobData),
  startRenderQueue: () => ipcRenderer.invoke('start-render-queue'),
  stopAllRenders: () => ipcRenderer.invoke('stop-all-renders'),
  clearCompletedJobs: () => ipcRenderer.invoke('clear-completed-jobs'),
  getAllJobs: () => ipcRenderer.invoke('get-all-jobs'),
  cancelJob: (jobId: string) => ipcRenderer.invoke('cancel-job', jobId),
  removeJob: (jobId: string) => ipcRenderer.invoke('remove-job', jobId),

  // Event listeners
  onBlendFilesSelected: (callback) => {
    ipcRenderer.on('blend-files-selected', (_, filePaths) => callback(filePaths));
  },
  onRenderJobCreated: (callback) => {
    ipcRenderer.on('render-job-created', (_, job) => callback(job));
  },
  onRenderJobUpdated: (callback) => {
    ipcRenderer.on('render-job-updated', (_, job) => callback(job));
  },
  onJobsCleared: (callback) => {
    ipcRenderer.on('jobs-cleared', (_, jobIds) => callback(jobIds));
  },
  onJobRemoved: (callback) => {
    ipcRenderer.on('job-removed', (_, jobId) => callback(jobId));
  },
  onMenuAction: (callback) => {
    ipcRenderer.on('menu-action', (_, action) => callback(action));
  },

  // Remove listeners
  removeAllListeners: (channel: string) => {
    ipcRenderer.removeAllListeners(channel);
  }
};

contextBridge.exposeInMainWorld('electronAPI', electronAPI);