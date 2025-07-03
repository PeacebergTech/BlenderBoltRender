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