import { app, BrowserWindow, Menu, dialog, ipcMain, shell } from 'electron';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs/promises';
import { spawn, ChildProcess } from 'node:child_process';
import { v4 as uuidv4 } from 'uuid';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// The built directory structure
//
// ├─┬─┬ dist
// │ │ └── index.html
// │ │
// │ ├─┬ dist-electron
// │ │ ├── main.js
// │ │ └── preload.mjs
// │
process.env.APP_ROOT = path.join(__dirname, '..');

export const VITE_DEV_SERVER_URL = process.env['VITE_DEV_SERVER_URL'];
export const MAIN_DIST = path.join(process.env.APP_ROOT, 'dist-electron');
export const RENDERER_DIST = path.join(process.env.APP_ROOT, 'dist');

process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL ? path.join(process.env.APP_ROOT, 'public') : RENDERER_DIST;

let win: BrowserWindow | null;

// Render job management
interface RenderJob {
  id: string;
  blendFile: string;
  outputPath: string;
  startFrame: number;
  endFrame: number;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  progress: number;
  process?: ChildProcess;
  createdAt: Date;
  completedAt?: Date;
  error?: string;
}

const renderJobs = new Map<string, RenderJob>();
const renderQueue: string[] = [];
let isProcessingQueue = false;

function createWindow() {
  win = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1200,
    minHeight: 700,
    icon: path.join(process.env.VITE_PUBLIC, 'icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.mjs'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    titleBarStyle: 'default',
    show: false,
  });

  // Show window when ready to prevent visual flash
  win.once('ready-to-show', () => {
    win?.show();
  });

  // Test active push message to Renderer-process.
  win.webContents.on('did-finish-load', () => {
    win?.webContents.send('main-process-message', new Date().toLocaleString());
  });

  if (VITE_DEV_SERVER_URL) {
    win.loadURL(VITE_DEV_SERVER_URL);
  } else {
    win.loadFile(path.join(RENDERER_DIST, 'index.html'));
  }

  // Create application menu
  createMenu();
}

function createMenu() {
  const template: Electron.MenuItemConstructorOptions[] = [
    {
      label: 'File',
      submenu: [
        {
          label: 'New Project',
          accelerator: 'CmdOrCtrl+N',
          click: () => {
            win?.webContents.send('menu-action', 'new-project');
          }
        },
        {
          label: 'Open Project',
          accelerator: 'CmdOrCtrl+O',
          click: () => {
            win?.webContents.send('menu-action', 'open-project');
          }
        },
        { type: 'separator' },
        {
          label: 'Add Blend Files',
          accelerator: 'CmdOrCtrl+Shift+A',
          click: () => {
            selectBlendFiles();
          }
        },
        { type: 'separator' },
        {
          label: 'Exit',
          accelerator: process.platform === 'darwin' ? 'Cmd+Q' : 'Ctrl+Q',
          click: () => {
            app.quit();
          }
        }
      ]
    },
    {
      label: 'Edit',
      submenu: [
        { label: 'Undo', accelerator: 'CmdOrCtrl+Z', role: 'undo' },
        { label: 'Redo', accelerator: 'Shift+CmdOrCtrl+Z', role: 'redo' },
        { type: 'separator' },
        { label: 'Cut', accelerator: 'CmdOrCtrl+X', role: 'cut' },
        { label: 'Copy', accelerator: 'CmdOrCtrl+C', role: 'copy' },
        { label: 'Paste', accelerator: 'CmdOrCtrl+V', role: 'paste' }
      ]
    },
    {
      label: 'Render',
      submenu: [
        {
          label: 'Start Render Queue',
          accelerator: 'F5',
          click: () => {
            startRenderQueue();
          }
        },
        {
          label: 'Stop All Renders',
          accelerator: 'Shift+F5',
          click: () => {
            stopAllRenders();
          }
        },
        { type: 'separator' },
        {
          label: 'Clear Completed Jobs',
          click: () => {
            clearCompletedJobs();
          }
        }
      ]
    },
    {
      label: 'View',
      submenu: [
        { label: 'Reload', accelerator: 'CmdOrCtrl+R', role: 'reload' },
        { label: 'Force Reload', accelerator: 'CmdOrCtrl+Shift+R', role: 'forceReload' },
        { label: 'Toggle Developer Tools', accelerator: 'F12', role: 'toggleDevTools' },
        { type: 'separator' },
        { label: 'Actual Size', accelerator: 'CmdOrCtrl+0', role: 'resetZoom' },
        { label: 'Zoom In', accelerator: 'CmdOrCtrl+Plus', role: 'zoomIn' },
        { label: 'Zoom Out', accelerator: 'CmdOrCtrl+-', role: 'zoomOut' },
        { type: 'separator' },
        { label: 'Toggle Fullscreen', accelerator: 'F11', role: 'togglefullscreen' }
      ]
    },
    {
      label: 'Help',
      submenu: [
        {
          label: 'About Blender Render Farm',
          click: () => {
            dialog.showMessageBox(win!, {
              type: 'info',
              title: 'About',
              message: 'Blender Batch Render Farm',
              detail: 'Version 1.0.0\n\nA powerful desktop application for managing Blender render jobs in batch mode.',
              buttons: ['OK']
            });
          }
        },
        {
          label: 'Learn More',
          click: () => {
            shell.openExternal('https://www.blender.org/');
          }
        }
      ]
    }
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

// IPC Handlers
async function selectBlendFiles() {
  if (!win) return;

  const result = await dialog.showOpenDialog(win, {
    title: 'Select Blender Files',
    filters: [
      { name: 'Blender Files', extensions: ['blend'] },
      { name: 'All Files', extensions: ['*'] }
    ],
    properties: ['openFile', 'multiSelections']
  });

  if (!result.canceled && result.filePaths.length > 0) {
    win.webContents.send('blend-files-selected', result.filePaths);
  }
}

async function selectOutputDirectory() {
  if (!win) return;

  const result = await dialog.showOpenDialog(win, {
    title: 'Select Output Directory',
    properties: ['openDirectory']
  });

  if (!result.canceled && result.filePaths.length > 0) {
    return result.filePaths[0];
  }
  return null;
}

async function checkBlenderInstallation(): Promise<string | null> {
  const possiblePaths = [
    'blender', // System PATH
    '/usr/bin/blender', // Linux
    '/usr/local/bin/blender', // Linux/macOS
    '/Applications/Blender.app/Contents/MacOS/Blender', // macOS
    'C:\\Program Files\\Blender Foundation\\Blender 4.0\\blender.exe', // Windows
    'C:\\Program Files\\Blender Foundation\\Blender 3.6\\blender.exe', // Windows
  ];

  for (const blenderPath of possiblePaths) {
    try {
      await fs.access(blenderPath);
      return blenderPath;
    } catch {
      continue;
    }
  }

  return null;
}

async function createRenderJob(jobData: {
  blendFile: string;
  outputPath: string;
  startFrame: number;
  endFrame: number;
}): Promise<string> {
  const job: RenderJob = {
    id: uuidv4(),
    ...jobData,
    status: 'pending',
    progress: 0,
    createdAt: new Date()
  };

  renderJobs.set(job.id, job);
  renderQueue.push(job.id);

  // Notify renderer about new job
  win?.webContents.send('render-job-created', job);

  return job.id;
}

async function startRenderQueue() {
  if (isProcessingQueue) return;

  const blenderPath = await checkBlenderInstallation();
  if (!blenderPath) {
    dialog.showErrorBox('Blender Not Found', 'Blender installation not found. Please install Blender and ensure it\'s in your system PATH.');
    return;
  }

  isProcessingQueue = true;
  processNextJob(blenderPath);
}

async function processNextJob(blenderPath: string) {
  if (renderQueue.length === 0) {
    isProcessingQueue = false;
    return;
  }

  const jobId = renderQueue.shift()!;
  const job = renderJobs.get(jobId);
  
  if (!job || job.status !== 'pending') {
    processNextJob(blenderPath);
    return;
  }

  job.status = 'running';
  win?.webContents.send('render-job-updated', job);

  try {
    // Ensure output directory exists
    await fs.mkdir(path.dirname(job.outputPath), { recursive: true });

    // Build Blender command
    const args = [
      '--background',
      job.blendFile,
      '--render-output', job.outputPath,
      '--render-frame', `${job.startFrame}..${job.endFrame}`
    ];

    console.log('Starting render:', blenderPath, args.join(' '));

    const renderProcess = spawn(blenderPath, args);
    job.process = renderProcess;

    let currentFrame = job.startFrame;
    const totalFrames = job.endFrame - job.startFrame + 1;

    renderProcess.stdout?.on('data', (data) => {
      const output = data.toString();
      console.log('Blender output:', output);

      // Parse frame progress from Blender output
      const frameMatch = output.match(/Fra:(\d+)/);
      if (frameMatch) {
        currentFrame = parseInt(frameMatch[1]);
        job.progress = Math.round(((currentFrame - job.startFrame) / totalFrames) * 100);
        win?.webContents.send('render-job-updated', job);
      }
    });

    renderProcess.stderr?.on('data', (data) => {
      console.error('Blender error:', data.toString());
    });

    renderProcess.on('close', (code) => {
      if (code === 0) {
        job.status = 'completed';
        job.progress = 100;
        job.completedAt = new Date();
      } else if (job.status !== 'cancelled') {
        job.status = 'failed';
        job.error = `Render process exited with code ${code}`;
      }

      job.process = undefined;
      win?.webContents.send('render-job-updated', job);

      // Process next job
      setTimeout(() => processNextJob(blenderPath), 1000);
    });

    renderProcess.on('error', (error) => {
      job.status = 'failed';
      job.error = error.message;
      job.process = undefined;
      win?.webContents.send('render-job-updated', job);

      // Process next job
      setTimeout(() => processNextJob(blenderPath), 1000);
    });

  } catch (error) {
    job.status = 'failed';
    job.error = error instanceof Error ? error.message : 'Unknown error';
    win?.webContents.send('render-job-updated', job);

    // Process next job
    setTimeout(() => processNextJob(blenderPath), 1000);
  }
}

function stopAllRenders() {
  renderJobs.forEach(job => {
    if (job.status === 'running' && job.process) {
      job.status = 'cancelled';
      job.process.kill();
      job.process = undefined;
      win?.webContents.send('render-job-updated', job);
    }
  });

  renderQueue.length = 0;
  isProcessingQueue = false;
}

function clearCompletedJobs() {
  const completedJobs: string[] = [];
  renderJobs.forEach((job, id) => {
    if (job.status === 'completed' || job.status === 'failed') {
      completedJobs.push(id);
    }
  });

  completedJobs.forEach(id => renderJobs.delete(id));
  win?.webContents.send('jobs-cleared', completedJobs);
}

// IPC Event Handlers
ipcMain.handle('select-blend-files', selectBlendFiles);
ipcMain.handle('select-output-directory', selectOutputDirectory);
ipcMain.handle('check-blender', checkBlenderInstallation);
ipcMain.handle('create-render-job', async (_, jobData) => createRenderJob(jobData));
ipcMain.handle('start-render-queue', startRenderQueue);
ipcMain.handle('stop-all-renders', stopAllRenders);
ipcMain.handle('clear-completed-jobs', clearCompletedJobs);
ipcMain.handle('get-all-jobs', () => Array.from(renderJobs.values()));

ipcMain.handle('cancel-job', (_, jobId: string) => {
  const job = renderJobs.get(jobId);
  if (job && job.status === 'running' && job.process) {
    job.status = 'cancelled';
    job.process.kill();
    job.process = undefined;
    win?.webContents.send('render-job-updated', job);
  }
});

ipcMain.handle('remove-job', (_, jobId: string) => {
  const job = renderJobs.get(jobId);
  if (job) {
    if (job.status === 'running' && job.process) {
      job.process.kill();
    }
    renderJobs.delete(jobId);
    const queueIndex = renderQueue.indexOf(jobId);
    if (queueIndex > -1) {
      renderQueue.splice(queueIndex, 1);
    }
    win?.webContents.send('job-removed', jobId);
  }
});

ipcMain.handle('open-output-folder', async (_, outputPath: string) => {
  const dir = path.dirname(outputPath);
  shell.openPath(dir);
});

// App event handlers
app.on('window-all-closed', () => {
  // Stop all renders before closing
  stopAllRenders();
  
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

app.whenReady().then(() => {
  createWindow();
});