import { BlenderAPI } from './BlenderService';
import { BlenderRenderOptions, RenderProgress } from '../types/blender';

export interface QueueItem {
  id: string;
  blendFile: string;
  outputPath: string;
  options: BlenderRenderOptions;
  status: 'pending' | 'rendering' | 'completed' | 'error' | 'cancelled';
  progress: number;
  startTime?: Date;
  endTime?: Date;
  error?: string;
  currentFrame?: number;
  totalFrames?: number;
}

export class RenderQueue {
  private queue: QueueItem[] = [];
  private isProcessing = false;
  private isPaused = false;
  private currentItem: QueueItem | null = null;
  private progressCallbacks: ((item: QueueItem) => void)[] = [];
  private queueCallbacks: ((queue: QueueItem[]) => void)[] = [];
  private blenderAPI: BlenderAPI | null = null;

  public setBlenderAPI(blenderAPI: BlenderAPI): void {
    this.blenderAPI = blenderAPI;
  }

  public addToQueue(item: Omit<QueueItem, 'id' | 'status' | 'progress'>): string {
    const queueItem: QueueItem = {
      ...item,
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      status: 'pending',
      progress: 0
    };

    this.queue.push(queueItem);
    this.notifyQueueUpdate();
    
    if (!this.isProcessing && !this.isPaused) {
      this.processQueue();
    }

    return queueItem.id;
  }

  public removeFromQueue(id: string): boolean {
    const index = this.queue.findIndex(item => item.id === id);
    if (index === -1) return false;

    const item = this.queue[index];
    
    // If item is currently rendering, cancel it
    if (item.status === 'rendering' && this.blenderAPI) {
      this.blenderAPI.cancelRender(item.blendFile);
    }

    this.queue.splice(index, 1);
    this.notifyQueueUpdate();
    return true;
  }

  public clearQueue(): void {
    // Cancel all active renders
    if (this.blenderAPI) {
      this.blenderAPI.cancelAllRenders();
    }
    
    // Clear the queue
    this.queue = [];
    this.currentItem = null;
    this.isProcessing = false;
    this.notifyQueueUpdate();
  }

  public startQueue(): void {
    this.isPaused = false;
    if (!this.isProcessing) {
      this.processQueue();
    }
  }

  public pauseQueue(): void {
    this.isPaused = true;
  }

  public stopQueue(): void {
    this.isPaused = true;
    if (this.blenderAPI) {
      this.blenderAPI.cancelAllRenders();
    }
    
    // Reset current item status
    if (this.currentItem) {
      this.currentItem.status = 'cancelled';
      this.currentItem.endTime = new Date();
      this.notifyProgressUpdate(this.currentItem);
    }
    
    this.currentItem = null;
    this.isProcessing = false;
  }

  public getQueue(): QueueItem[] {
    return [...this.queue];
  }

  public getQueueStats() {
    const total = this.queue.length;
    const pending = this.queue.filter(item => item.status === 'pending').length;
    const rendering = this.queue.filter(item => item.status === 'rendering').length;
    const completed = this.queue.filter(item => item.status === 'completed').length;
    const failed = this.queue.filter(item => item.status === 'error').length;
    const cancelled = this.queue.filter(item => item.status === 'cancelled').length;

    return {
      total,
      pending,
      rendering,
      completed,
      failed,
      cancelled,
      isProcessing: this.isProcessing,
      isPaused: this.isPaused,
      currentItem: this.currentItem
    };
  }

  public onProgressUpdate(callback: (item: QueueItem) => void): void {
    this.progressCallbacks.push(callback);
  }

  public onQueueUpdate(callback: (queue: QueueItem[]) => void): void {
    this.queueCallbacks.push(callback);
  }

  public removeProgressCallback(callback: (item: QueueItem) => void): void {
    const index = this.progressCallbacks.indexOf(callback);
    if (index > -1) {
      this.progressCallbacks.splice(index, 1);
    }
  }

  public removeQueueCallback(callback: (queue: QueueItem[]) => void): void {
    const index = this.queueCallbacks.indexOf(callback);
    if (index > -1) {
      this.queueCallbacks.splice(index, 1);
    }
  }

  private async processQueue(): Promise<void> {
    if (this.isProcessing || this.isPaused || !this.blenderAPI) return;

    this.isProcessing = true;

    while (this.queue.length > 0 && !this.isPaused) {
      const nextItem = this.queue.find(item => item.status === 'pending');
      if (!nextItem) break;

      this.currentItem = nextItem;
      nextItem.status = 'rendering';
      nextItem.startTime = new Date();
      nextItem.progress = 0;

      this.notifyProgressUpdate(nextItem);
      this.notifyQueueUpdate();

      try {
        await this.blenderAPI.renderFile(
          nextItem.options,
          (progress: RenderProgress) => {
            nextItem.progress = progress.percentage;
            nextItem.currentFrame = progress.frame;
            nextItem.totalFrames = progress.totalFrames;
            
            if (progress.status === 'error') {
              nextItem.status = 'error';
              nextItem.error = progress.message;
              nextItem.endTime = new Date();
            } else if (progress.status === 'cancelled') {
              nextItem.status = 'cancelled';
              nextItem.endTime = new Date();
            } else if (progress.status === 'completed') {
              nextItem.status = 'completed';
              nextItem.progress = 100;
              nextItem.endTime = new Date();
            }

            this.notifyProgressUpdate(nextItem);
          }
        );

        if (nextItem.status === 'rendering') {
          nextItem.status = 'completed';
          nextItem.progress = 100;
          nextItem.endTime = new Date();
        }

      } catch (error) {
        nextItem.status = 'error';
        nextItem.error = error instanceof Error ? error.message : 'Unknown error';
        nextItem.endTime = new Date();
      }

      this.notifyProgressUpdate(nextItem);
      this.notifyQueueUpdate();
      this.currentItem = null;

      // Small delay between renders
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    this.isProcessing = false;
  }

  private notifyProgressUpdate(item: QueueItem): void {
    this.progressCallbacks.forEach(callback => {
      try {
        callback(item);
      } catch (error) {
        console.error('Error in progress callback:', error);
      }
    });
  }

  private notifyQueueUpdate(): void {
    this.queueCallbacks.forEach(callback => {
      try {
        callback([...this.queue]);
      } catch (error) {
        console.error('Error in queue callback:', error);
      }
    });
  }

  public moveItemUp(id: string): boolean {
    const index = this.queue.findIndex(item => item.id === id);
    if (index <= 0) return false;

    [this.queue[index], this.queue[index - 1]] = [this.queue[index - 1], this.queue[index]];
    this.notifyQueueUpdate();
    return true;
  }

  public moveItemDown(id: string): boolean {
    const index = this.queue.findIndex(item => item.id === id);
    if (index === -1 || index >= this.queue.length - 1) return false;

    [this.queue[index], this.queue[index + 1]] = [this.queue[index + 1], this.queue[index]];
    this.notifyQueueUpdate();
    return true;
  }

  public retryItem(id: string): boolean {
    const item = this.queue.find(item => item.id === id);
    if (!item || (item.status !== 'error' && item.status !== 'cancelled')) return false;

    item.status = 'pending';
    item.progress = 0;
    item.error = undefined;
    item.startTime = undefined;
    item.endTime = undefined;

    this.notifyProgressUpdate(item);
    this.notifyQueueUpdate();

    if (!this.isProcessing && !this.isPaused) {
      this.processQueue();
    }

    return true;
  }
}

export const renderQueue = new RenderQueue();