import { useState, useEffect, useCallback } from 'react';
import { renderQueue, QueueItem } from '../services/RenderQueue';

export const useRenderQueue = () => {
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [stats, setStats] = useState(renderQueue.getQueueStats());

  const updateQueue = useCallback((newQueue: QueueItem[]) => {
    setQueue(newQueue);
    setStats(renderQueue.getQueueStats());
  }, []);

  const updateProgress = useCallback((item: QueueItem) => {
    setQueue(currentQueue => 
      currentQueue.map(queueItem => 
        queueItem.id === item.id ? item : queueItem
      )
    );
    setStats(renderQueue.getQueueStats());
  }, []);

  useEffect(() => {
    // Initialize with current queue
    setQueue(renderQueue.getQueue());
    setStats(renderQueue.getQueueStats());

    // Set up listeners
    renderQueue.onQueueUpdate(updateQueue);
    renderQueue.onProgressUpdate(updateProgress);

    return () => {
      renderQueue.removeQueueCallback(updateQueue);
      renderQueue.removeProgressCallback(updateProgress);
    };
  }, [updateQueue, updateProgress]);

  const addToQueue = useCallback((
    blendFile: string,
    outputPath: string,
    options: any
  ) => {
    return renderQueue.addToQueue({
      blendFile,
      outputPath,
      options: {
        blendFile,
        outputPath,
        ...options
      }
    });
  }, []);

  const removeFromQueue = useCallback((id: string) => {
    return renderQueue.removeFromQueue(id);
  }, []);

  const clearQueue = useCallback(() => {
    renderQueue.clearQueue();
  }, []);

  const startQueue = useCallback(() => {
    renderQueue.startQueue();
  }, []);

  const pauseQueue = useCallback(() => {
    renderQueue.pauseQueue();
  }, []);

  const stopQueue = useCallback(() => {
    renderQueue.stopQueue();
  }, []);

  const moveItemUp = useCallback((id: string) => {
    return renderQueue.moveItemUp(id);
  }, []);

  const moveItemDown = useCallback((id: string) => {
    return renderQueue.moveItemDown(id);
  }, []);

  const retryItem = useCallback((id: string) => {
    return renderQueue.retryItem(id);
  }, []);

  return {
    queue,
    stats,
    addToQueue,
    removeFromQueue,
    clearQueue,
    startQueue,
    pauseQueue,
    stopQueue,
    moveItemUp,
    moveItemDown,
    retryItem
  };
};