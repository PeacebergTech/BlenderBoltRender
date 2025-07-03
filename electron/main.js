import { app, BrowserWindow, Menu, dialog, ipcMain, shell } from 'electron';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { existsSync } from 'fs';
import { spawn, ChildProcess } from 'child_process';
import { mkdir } from 'fs/promises';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Keep a global reference of the window object
let mainWindow;

const isDev = process.env.NODE_ENV === 'development';
const isMac = process.platform === 'darwin';

// Blender Service in Main Process
class MainBlenderService {
  constructor() {
    this.blenderPath = '';
    this.renderProcesses = new Map();
    this.progressCallbacks = new Map();
    this.detectBlenderPath();
  }

  async detectBlenderPath() {
    const possiblePaths = this.getPossibleBlenderPaths();
    
    for (const path of possiblePaths) {
      if (existsSync(path)) {
        this.blenderPath = path;
        console.log(`Blender found at: ${path}`);
        return;
      }
    }
    
    console.warn('Blender not found in common locations');
  }

  getPossibleBlenderPaths() {
    const platform = process.platform;
    
    switch (platform) {
      case 'win32':
        return [
          'C:\\Program Files\\Blender Foundation\\Blender 4.0\\blender.exe',
          'C:\\Program Files\\Blender Foundation\\Blender 3.6\\blender.exe',
          'C:\\Program Files\\Blender Foundation\\Blender 3.5\\blender.exe',
          'C:\\Program Files\\Blender Foundation\\Blender 3.4\\blender.exe',
          'C:\\Program Files (x86)\\Blender Foundation\\Blender 4.0\\blender.exe',
          'C:\\Program Files (x86)\\Blender Foundation\\Blender 3.6\\blender.exe',
          'blender.exe'
        ];
      case 'darwin':
        return [
          '/Applications/Blender.app/Contents/MacOS/Blender',
          '/usr/local/bin/blender',
          'blender'
        ];
      case 'linux':
        return [
          '/usr/bin/blender',
          '/usr/local/bin/blender',
          '/opt/blender/blender',
          '/snap/bin/blender',
          'blender'
        ];
      default:
        return ['blender'];
    }
  }

  setBlenderPath(path) {
    this.blenderPath = path;
  }

  getBlenderPath() {
    return this.blenderPath;
  }

  async isBlenderAvailable() {
    if (!this.blenderPath) {
      await this.detectBlenderPath();
    }
    
    return new Promise((resolve) => {
      const process = spawn(this.blenderPath, ['--version'], { stdio: 'pipe' });
      
      process.on('close', (code) => {
        resolve(code === 0);
      });
      
      process.on('error', () => {
        resolve(false);
      });
      
      setTimeout(() => {
        process.kill();
        resolve(false);
      }, 5000);
    });
  }

  async getBlenderVersion() {
    if (!await this.isBlenderAvailable()) {
      throw new Error('Blender is not available');
    }

    return new Promise((resolve, reject) => {
      const process = spawn(this.blenderPath, ['--version'], { stdio: 'pipe' });
      let output = '';

      process.stdout.on('data', (data) => {
        output += data.toString();
      });

      process.on('close', (code) => {
        if (code === 0) {
          const versionMatch = output.match(/Blender (\d+\.\d+\.\d+)/);
          resolve(versionMatch ? versionMatch[1] : 'Unknown');
        } else {
          reject(new Error('Failed to get Blender version'));
        }
      });

      process.on('error', (error) => {
        reject(error);
      });
    });
  }

  async renderFile(options, progressId) {
    if (!await this.isBlenderAvailable()) {
      throw new Error('Blender is not available. Please install Blender or set the correct path.');
    }

    if (!existsSync(options.blendFile)) {
      throw new Error(`Blend file not found: ${options.blendFile}`);
    }

    const outputDir = dirname(options.outputPath);
    if (!existsSync(outputDir)) {
      await mkdir(outputDir, { recursive: true });
    }

    const processId = `${options.blendFile}-${Date.now()}`;
    const args = this.buildBlenderArgs(options);

    return new Promise((resolve, reject) => {
      const blenderProcess = spawn(this.blenderPath, args, {
        stdio: 'pipe',
        cwd: dirname(options.blendFile)
      });

      this.renderProcesses.set(processId, blenderProcess);

      let output = '';
      let errorOutput = '';
      let currentFrame = options.startFrame || 1;
      const totalFrames = (options.endFrame || 1) - (options.startFrame || 1) + 1;

      blenderProcess.stdout.on('data', (data) => {
        const text = data.toString();
        output += text;
        
        this.parseBlenderOutput(text, processId, currentFrame, totalFrames, options.blendFile, progressId);
      });

      blenderProcess.stderr.on('data', (data) => {
        const text = data.toString();
        errorOutput += text;
        console.error('Blender stderr:', text);
      });

      blenderProcess.on('close', (code) => {
        this.renderProcesses.delete(processId);

        if (code === 0) {
          mainWindow?.webContents.send('blender-progress', progressId, {
            frame: totalFrames,
            totalFrames,
            percentage: 100,
            currentFile: options.blendFile,
            status: 'completed',
            message: 'Render completed successfully'
          });
          resolve();
        } else if (code === null) {
          mainWindow?.webContents.send('blender-progress', progressId, {
            frame: currentFrame,
            totalFrames,
            percentage: (currentFrame / totalFrames) * 100,
            currentFile: options.blendFile,
            status: 'cancelled',
            message: 'Render was cancelled'
          });
          reject(new Error('Render was cancelled'));
        } else {
          mainWindow?.webContents.send('blender-progress', progressId, {
            frame: currentFrame,
            totalFrames,
            percentage: (currentFrame / totalFrames) * 100,
            currentFile: options.blendFile,
            status: 'error',
            message: `Render failed with code ${code}`
          });
          reject(new Error(`Blender process failed with code ${code}: ${errorOutput}`));
        }
      });

      blenderProcess.on('error', (error) => {
        this.renderProcesses.delete(processId);
        
        mainWindow?.webContents.send('blender-progress', progressId, {
          frame: currentFrame,
          totalFrames,
          percentage: 0,
          currentFile: options.blendFile,
          status: 'error',
          message: `Failed to start render: ${error.message}`
        });
        reject(error);
      });
    });
  }

  buildBlenderArgs(options) {
    const args = [
      '--background',
      options.blendFile,
      '--render-output', options.outputPath,
    ];

    if (options.startFrame !== undefined && options.endFrame !== undefined) {
      args.push('--frame-start', options.startFrame.toString());
      args.push('--frame-end', options.endFrame.toString());
    } else if (options.startFrame !== undefined) {
      args.push('--frame-set', options.startFrame.toString());
    }

    if (options.engine || options.samples || options.resolution || options.format || options.threads || options.gpu) {
      const pythonScript = this.generatePythonScript(options);
      args.push('--python-expr', pythonScript);
    }

    if (options.startFrame !== undefined && options.endFrame !== undefined && options.endFrame > options.startFrame) {
      args.push('--render-anim');
    } else {
      args.push('--render-frame', (options.startFrame || 1).toString());
    }

    return args;
  }

  generatePythonScript(options) {
    const scripts = [];

    if (options.engine) {
      scripts.push(`bpy.context.scene.render.engine = '${options.engine}'`);
    }

    if (options.samples && (options.engine === 'CYCLES' || !options.engine)) {
      scripts.push(`bpy.context.scene.cycles.samples = ${options.samples}`);
    }

    if (options.resolution) {
      scripts.push(`bpy.context.scene.render.resolution_x = ${options.resolution[0]}`);
      scripts.push(`bpy.context.scene.render.resolution_y = ${options.resolution[1]}`);
    }

    if (options.format) {
      const formatMap = {
        'PNG': 'PNG',
        'JPEG': 'JPEG',
        'TIFF': 'TIFF',
        'EXR': 'OPEN_EXR',
        'FFMPEG': 'FFMPEG'
      };
      scripts.push(`bpy.context.scene.render.image_settings.file_format = '${formatMap[options.format]}'`);
    }

    if (options.quality && options.format === 'JPEG') {
      scripts.push(`bpy.context.scene.render.image_settings.quality = ${options.quality}`);
    }

    if (options.threads) {
      scripts.push(`bpy.context.scene.render.threads_mode = 'FIXED'`);
      scripts.push(`bpy.context.scene.render.threads = ${options.threads}`);
    }

    if (options.gpu) {
      scripts.push(`bpy.context.preferences.addons['cycles'].preferences.compute_device_type = 'CUDA'`);
      scripts.push(`bpy.context.scene.cycles.device = 'GPU'`);
    }

    return `import bpy; ${scripts.join('; ')}`;
  }

  parseBlenderOutput(output, processId, currentFrame, totalFrames, blendFile, progressId) {
    const frameMatch = output.match(/Fra:(\d+)/);
    if (frameMatch) {
      currentFrame = parseInt(frameMatch[1]);
    }

    const progressMatch = output.match(/(\d+)%/);
    let percentage = 0;
    if (progressMatch) {
      percentage = parseInt(progressMatch[1]);
    }

    const timeMatch = output.match(/Time:(\d+:\d+\.\d+)/);
    const timeRemaining = timeMatch ? timeMatch[1] : undefined;

    let status = 'rendering';
    let message = '';

    if (output.includes('Saved:')) {
      status = 'completed';
      message = 'Frame rendered successfully';
    } else if (output.includes('Error:') || output.includes('EXCEPTION')) {
      status = 'error';
      message = 'Render error occurred';
    }

    mainWindow?.webContents.send('blender-progress', progressId, {
      frame: currentFrame,
      totalFrames,
      percentage: Math.round((currentFrame / totalFrames) * 100),
      timeRemaining,
      currentFile: blendFile.split('/').pop() || blendFile.split('\\').pop(),
      status,
      message
    });
  }

  cancelRender(blendFile) {
    for (const [processId, process] of this.renderProcesses.entries()) {
      if (processId.includes(blendFile)) {
        process.kill('SIGTERM');
        this.renderProcesses.delete(processId);
        break;
      }
    }
  }

  cancelAllRenders() {
    for (const [processId, process] of this.renderProcesses.entries()) {
      process.kill('SIGTERM');
    }
    this.renderProcesses.clear();
  }

  getActiveRenders() {
    return Array.from(this.renderProcesses.keys());
  }

  isRenderActive(blendFile) {
    for (const processId of this.renderProcesses.keys()) {
      if (processId.includes(blendFile)) {
        return true;
      }
    }
    return false;
  }
}

const mainBlenderService = new MainBlenderService();

function createWindow() {
  // Create the browser window
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1200,
    minHeight: 700,
    icon: join(__dirname, 'assets', 'icon.png'),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      enableRemoteModule: false,
      preload: join(__dirname, 'preload.js')
    },
    titleBarStyle: isMac ? 'hiddenInset' : 'default',
    show: false
  });

  // Load the app
  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(join(__dirname, '../dist/index.html'));
  }

  // Show window when ready to prevent visual flash
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  // Handle window closed
  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // Handle external links
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });
}

// Create application menu
function createMenu() {
  const template = [
    ...(isMac ? [{
      label: app.getName(),
      submenu: [
        { role: 'about' },
        { type: 'separator' },
        { role: 'services' },
        { type: 'separator' },
        { role: 'hide' },
        { role: 'hideothers' },
        { role: 'unhide' },
        { type: 'separator' },
        { role: 'quit' }
      ]
    }] : []),
    {
      label: 'File',
      submenu: [
        {
          label: 'New Project',
          accelerator: 'CmdOrCtrl+N',
          click: () => {
            mainWindow.webContents.send('menu-action', 'new-project');
          }
        },
        {
          label: 'Open Project',
          accelerator: 'CmdOrCtrl+O',
          click: async () => {
            const result = await dialog.showOpenDialog(mainWindow, {
              properties: ['openFile'],
              filters: [
                { name: 'Render Farm Projects', extensions: ['rfp'] },
                { name: 'All Files', extensions: ['*'] }
              ]
            });
            
            if (!result.canceled) {
              mainWindow.webContents.send('menu-action', 'open-project', result.filePaths[0]);
            }
          }
        },
        {
          label: 'Save Project',
          accelerator: 'CmdOrCtrl+S',
          click: () => {
            mainWindow.webContents.send('menu-action', 'save-project');
          }
        },
        {
          label: 'Save Project As...',
          accelerator: 'CmdOrCtrl+Shift+S',
          click: async () => {
            const result = await dialog.showSaveDialog(mainWindow, {
              filters: [
                { name: 'Render Farm Projects', extensions: ['rfp'] }
              ]
            });
            
            if (!result.canceled) {
              mainWindow.webContents.send('menu-action', 'save-project-as', result.filePath);
            }
          }
        },
        { type: 'separator' },
        {
          label: 'Add Blend Files',
          accelerator: 'CmdOrCtrl+A',
          click: async () => {
            const result = await dialog.showOpenDialog(mainWindow, {
              properties: ['openFile', 'multiSelections'],
              filters: [
                { name: 'Blender Files', extensions: ['blend'] },
                { name: 'All Files', extensions: ['*'] }
              ]
            });
            
            if (!result.canceled) {
              mainWindow.webContents.send('menu-action', 'add-blend-files', result.filePaths);
            }
          }
        },
        { type: 'separator' },
        isMac ? { role: 'close' } : { role: 'quit' }
      ]
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectall' },
        { type: 'separator' },
        {
          label: 'Clear Queue',
          click: () => {
            mainWindow.webContents.send('menu-action', 'clear-queue');
          }
        }
      ]
    },
    {
      label: 'Render',
      submenu: [
        {
          label: 'Start Render',
          accelerator: 'F12',
          click: () => {
            mainWindow.webContents.send('menu-action', 'start-render');
          }
        },
        {
          label: 'Stop Render',
          accelerator: 'Escape',
          click: () => {
            mainWindow.webContents.send('menu-action', 'stop-render');
          }
        },
        {
          label: 'Pause/Resume',
          accelerator: 'Space',
          click: () => {
            mainWindow.webContents.send('menu-action', 'pause-resume');
          }
        },
        { type: 'separator' },
        {
          label: 'Open Output Folder',
          click: () => {
            mainWindow.webContents.send('menu-action', 'open-output-folder');
          }
        }
      ]
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' }
      ]
    },
    {
      label: 'Window',
      submenu: [
        { role: 'minimize' },
        { role: 'close' },
        ...(isMac ? [
          { type: 'separator' },
          { role: 'front' },
          { type: 'separator' },
          { role: 'window' }
        ] : [])
      ]
    },
    {
      label: 'Help',
      submenu: [
        {
          label: 'About Blender Render Farm',
          click: () => {
            dialog.showMessageBox(mainWindow, {
              type: 'info',
              title: 'About Blender Render Farm',
              message: 'Blender Batch Render Farm',
              detail: `Version: ${app.getVersion()}\nElectron: ${process.versions.electron}\nNode: ${process.versions.node}\nChrome: ${process.versions.chrome}`
            });
          }
        },
        {
          label: 'Learn More',
          click: () => {
            shell.openExternal('https://github.com/blender/blender');
          }
        }
      ]
    }
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

// IPC handlers
ipcMain.handle('select-blend-files', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile', 'multiSelections'],
    filters: [
      { name: 'Blender Files', extensions: ['blend'] },
      { name: 'All Files', extensions: ['*'] }
    ]
  });
  
  return result.canceled ? [] : result.filePaths;
});

ipcMain.handle('select-output-directory', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory']
  });
  
  return result.canceled ? null : result.filePaths[0];
});

ipcMain.handle('show-save-dialog', async (event, options) => {
  const result = await dialog.showSaveDialog(mainWindow, options);
  return result;
});

ipcMain.handle('show-open-dialog', async (event, options) => {
  const result = await dialog.showOpenDialog(mainWindow, options);
  return result;
});

ipcMain.handle('show-message-box', async (event, options) => {
  const result = await dialog.showMessageBox(mainWindow, options);
  return result;
});

ipcMain.handle('open-external', async (event, url) => {
  await shell.openExternal(url);
});

ipcMain.handle('show-item-in-folder', async (event, path) => {
  shell.showItemInFolder(path);
});

ipcMain.handle('get-app-version', () => {
  return app.getVersion();
});

ipcMain.handle('get-platform', () => {
  return process.platform;
});

// Blender IPC handlers
ipcMain.handle('blender-is-available', async () => {
  return await mainBlenderService.isBlenderAvailable();
});

ipcMain.handle('blender-get-version', async () => {
  return await mainBlenderService.getBlenderVersion();
});

ipcMain.handle('blender-set-path', async (event, path) => {
  mainBlenderService.setBlenderPath(path);
});

ipcMain.handle('blender-get-path', () => {
  return mainBlenderService.getBlenderPath();
});

ipcMain.handle('blender-render-file', async (event, options, progressId) => {
  return await mainBlenderService.renderFile(options, progressId);
});

ipcMain.handle('blender-cancel-render', async (event, blendFile) => {
  mainBlenderService.cancelRender(blendFile);
});

ipcMain.handle('blender-cancel-all-renders', async () => {
  mainBlenderService.cancelAllRenders();
});

ipcMain.handle('blender-get-active-renders', () => {
  return mainBlenderService.getActiveRenders();
});

ipcMain.handle('blender-is-render-active', (event, blendFile) => {
  return mainBlenderService.isRenderActive(blendFile);
});

// App event handlers
app.whenReady().then(() => {
  createWindow();
  createMenu();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (!isMac) {
    app.quit();
  }
});

// Security: Prevent new window creation
app.on('web-contents-created', (event, contents) => {
  contents.on('new-window', (event, navigationUrl) => {
    event.preventDefault();
    shell.openExternal(navigationUrl);
  });
});