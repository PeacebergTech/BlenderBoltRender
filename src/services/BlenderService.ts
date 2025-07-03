import { spawn, ChildProcess } from 'child_process';
import { existsSync } from 'fs';
import { join, dirname, basename } from 'path';
import { mkdir } from 'fs/promises';

export interface BlenderRenderOptions {
  blendFile: string;
  outputPath: string;
  startFrame?: number;
  endFrame?: number;
  engine?: 'CYCLES' | 'EEVEE' | 'WORKBENCH';
  samples?: number;
  resolution?: [number, number];
  format?: 'PNG' | 'JPEG' | 'TIFF' | 'EXR' | 'FFMPEG';
  quality?: number;
  threads?: number;
  gpu?: boolean;
}

export interface RenderProgress {
  frame: number;
  totalFrames: number;
  percentage: number;
  timeRemaining?: string;
  currentFile: string;
  status: 'rendering' | 'completed' | 'error' | 'cancelled';
  message?: string;
}

export class BlenderService {
  private blenderPath: string = '';
  private renderProcesses: Map<string, ChildProcess> = new Map();
  private progressCallbacks: Map<string, (progress: RenderProgress) => void> = new Map();

  constructor() {
    this.detectBlenderPath();
  }

  private async detectBlenderPath(): Promise<void> {
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

  private getPossibleBlenderPaths(): string[] {
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
          'blender.exe' // If in PATH
        ];
      case 'darwin':
        return [
          '/Applications/Blender.app/Contents/MacOS/Blender',
          '/usr/local/bin/blender',
          'blender' // If in PATH
        ];
      case 'linux':
        return [
          '/usr/bin/blender',
          '/usr/local/bin/blender',
          '/opt/blender/blender',
          '/snap/bin/blender',
          'blender' // If in PATH
        ];
      default:
        return ['blender'];
    }
  }

  public setBlenderPath(path: string): void {
    this.blenderPath = path;
  }

  public getBlenderPath(): string {
    return this.blenderPath;
  }

  public async isBlenderAvailable(): Promise<boolean> {
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
      
      // Timeout after 5 seconds
      setTimeout(() => {
        process.kill();
        resolve(false);
      }, 5000);
    });
  }

  public async getBlenderVersion(): Promise<string> {
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

  public async renderFile(
    options: BlenderRenderOptions,
    onProgress?: (progress: RenderProgress) => void
  ): Promise<void> {
    if (!await this.isBlenderAvailable()) {
      throw new Error('Blender is not available. Please install Blender or set the correct path.');
    }

    if (!existsSync(options.blendFile)) {
      throw new Error(`Blend file not found: ${options.blendFile}`);
    }

    // Create output directory if it doesn't exist
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
      if (onProgress) {
        this.progressCallbacks.set(processId, onProgress);
      }

      let output = '';
      let errorOutput = '';
      let currentFrame = options.startFrame || 1;
      const totalFrames = (options.endFrame || 1) - (options.startFrame || 1) + 1;

      blenderProcess.stdout.on('data', (data) => {
        const text = data.toString();
        output += text;
        
        // Parse Blender output for progress
        this.parseBlenderOutput(text, processId, currentFrame, totalFrames, options.blendFile);
      });

      blenderProcess.stderr.on('data', (data) => {
        const text = data.toString();
        errorOutput += text;
        console.error('Blender stderr:', text);
      });

      blenderProcess.on('close', (code) => {
        this.renderProcesses.delete(processId);
        this.progressCallbacks.delete(processId);

        if (code === 0) {
          if (onProgress) {
            onProgress({
              frame: totalFrames,
              totalFrames,
              percentage: 100,
              currentFile: options.blendFile,
              status: 'completed',
              message: 'Render completed successfully'
            });
          }
          resolve();
        } else if (code === null) {
          // Process was killed (cancelled)
          if (onProgress) {
            onProgress({
              frame: currentFrame,
              totalFrames,
              percentage: (currentFrame / totalFrames) * 100,
              currentFile: options.blendFile,
              status: 'cancelled',
              message: 'Render was cancelled'
            });
          }
          reject(new Error('Render was cancelled'));
        } else {
          if (onProgress) {
            onProgress({
              frame: currentFrame,
              totalFrames,
              percentage: (currentFrame / totalFrames) * 100,
              currentFile: options.blendFile,
              status: 'error',
              message: `Render failed with code ${code}`
            });
          }
          reject(new Error(`Blender process failed with code ${code}: ${errorOutput}`));
        }
      });

      blenderProcess.on('error', (error) => {
        this.renderProcesses.delete(processId);
        this.progressCallbacks.delete(processId);
        
        if (onProgress) {
          onProgress({
            frame: currentFrame,
            totalFrames,
            percentage: 0,
            currentFile: options.blendFile,
            status: 'error',
            message: `Failed to start render: ${error.message}`
          });
        }
        reject(error);
      });
    });
  }

  private buildBlenderArgs(options: BlenderRenderOptions): string[] {
    const args = [
      '--background', // Run without UI
      options.blendFile, // Blend file to render
      '--render-output', options.outputPath, // Output path
    ];

    // Frame range
    if (options.startFrame !== undefined && options.endFrame !== undefined) {
      args.push('--frame-start', options.startFrame.toString());
      args.push('--frame-end', options.endFrame.toString());
    } else if (options.startFrame !== undefined) {
      args.push('--frame-set', options.startFrame.toString());
    }

    // Python script for additional settings
    if (options.engine || options.samples || options.resolution || options.format || options.threads || options.gpu) {
      const pythonScript = this.generatePythonScript(options);
      args.push('--python-expr', pythonScript);
    }

    // Render animation or single frame
    if (options.startFrame !== undefined && options.endFrame !== undefined && options.endFrame > options.startFrame) {
      args.push('--render-anim');
    } else {
      args.push('--render-frame', (options.startFrame || 1).toString());
    }

    return args;
  }

  private generatePythonScript(options: BlenderRenderOptions): string {
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

  private parseBlenderOutput(
    output: string,
    processId: string,
    currentFrame: number,
    totalFrames: number,
    blendFile: string
  ): void {
    const callback = this.progressCallbacks.get(processId);
    if (!callback) return;

    // Parse frame progress
    const frameMatch = output.match(/Fra:(\d+)/);
    if (frameMatch) {
      currentFrame = parseInt(frameMatch[1]);
    }

    // Parse render progress percentage
    const progressMatch = output.match(/(\d+)%/);
    let percentage = 0;
    if (progressMatch) {
      percentage = parseInt(progressMatch[1]);
    }

    // Parse time remaining
    const timeMatch = output.match(/Time:(\d+:\d+\.\d+)/);
    const timeRemaining = timeMatch ? timeMatch[1] : undefined;

    // Check for completion or errors
    let status: 'rendering' | 'completed' | 'error' | 'cancelled' = 'rendering';
    let message = '';

    if (output.includes('Saved:')) {
      status = 'completed';
      message = 'Frame rendered successfully';
    } else if (output.includes('Error:') || output.includes('EXCEPTION')) {
      status = 'error';
      message = 'Render error occurred';
    }

    callback({
      frame: currentFrame,
      totalFrames,
      percentage: Math.round((currentFrame / totalFrames) * 100),
      timeRemaining,
      currentFile: basename(blendFile),
      status,
      message
    });
  }

  public cancelRender(blendFile: string): void {
    for (const [processId, process] of this.renderProcesses.entries()) {
      if (processId.includes(blendFile)) {
        process.kill('SIGTERM');
        this.renderProcesses.delete(processId);
        this.progressCallbacks.delete(processId);
        break;
      }
    }
  }

  public cancelAllRenders(): void {
    for (const [processId, process] of this.renderProcesses.entries()) {
      process.kill('SIGTERM');
    }
    this.renderProcesses.clear();
    this.progressCallbacks.clear();
  }

  public getActiveRenders(): string[] {
    return Array.from(this.renderProcesses.keys());
  }

  public isRenderActive(blendFile: string): boolean {
    for (const processId of this.renderProcesses.keys()) {
      if (processId.includes(blendFile)) {
        return true;
      }
    }
    return false;
  }
}

export const blenderService = new BlenderService();