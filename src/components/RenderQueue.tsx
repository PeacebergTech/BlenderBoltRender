import React, { useState, useEffect } from 'react';
import { Play, Square, Trash2, RotateCcw } from 'lucide-react';
import { useElectron } from '../hooks/useElectron';
import { RenderJobCard } from './RenderJobCard';

interface RenderJob {
  id: string;
  blendFile: string;
  outputPath: string;
  startFrame: number;
  endFrame: number;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  progress: number;
  createdAt: string;
  completedAt?: string;
  error?: string;
}

export function RenderQueue() {
  const { electronAPI } = useElectron();
  const [jobs, setJobs] = useState<RenderJob[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    if (electronAPI) {
      // Load existing jobs
      electronAPI.getAllJobs().then(setJobs);

      // Listen for job updates
      electronAPI.onRenderJobCreated((job: RenderJob) => {
        setJobs(prev => [...prev, job]);
      });

      electronAPI.onRenderJobUpdated((updatedJob: RenderJob) => {
        setJobs(prev => prev.map(job => 
          job.id === updatedJob.id ? updatedJob : job
        ));
        
        // Check if any job is running
        setIsProcessing(updatedJob.status === 'running' || 
          prev.some(job => job.status === 'running'));
      });

      electronAPI.onJobsCleared((jobIds: string[]) => {
        setJobs(prev => prev.filter(job => !jobIds.includes(job.id)));
      });

      electronAPI.onJobRemoved((jobId: string) => {
        setJobs(prev => prev.filter(job => job.id !== jobId));
      });

      return () => {
        electronAPI.removeAllListeners('render-job-created');
        electronAPI.removeAllListeners('render-job-updated');
        electronAPI.removeAllListeners('jobs-cleared');
        electronAPI.removeAllListeners('job-removed');
      };
    }
  }, [electronAPI]);

  const handleStartQueue = async () => {
    if (electronAPI) {
      setIsProcessing(true);
      await electronAPI.startRenderQueue();
    }
  };

  const handleStopQueue = async () => {
    if (electronAPI) {
      await electronAPI.stopAllRenders();
      setIsProcessing(false);
    }
  };

  const handleClearCompleted = async () => {
    if (electronAPI) {
      await electronAPI.clearCompletedJobs();
    }
  };

  const pendingJobs = jobs.filter(job => job.status === 'pending');
  const runningJobs = jobs.filter(job => job.status === 'running');
  const completedJobs = jobs.filter(job => job.status === 'completed');
  const failedJobs = jobs.filter(job => job.status === 'failed');

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900">Render Queue</h3>
        <div className="flex items-center space-x-3">
          <button
            onClick={handleClearCompleted}
            disabled={completedJobs.length === 0 && failedJobs.length === 0}
            className="inline-flex items-center px-3 py-2 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <Trash2 className="w-4 h-4 mr-2" />
            Clear Completed
          </button>
          
          {isProcessing ? (
            <button
              onClick={handleStopQueue}
              className="inline-flex items-center px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
            >
              <Square className="w-4 h-4 mr-2" />
              Stop Queue
            </button>
          ) : (
            <button
              onClick={handleStartQueue}
              disabled={pendingJobs.length === 0}
              className="inline-flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <Play className="w-4 h-4 mr-2" />
              Start Queue
            </button>
          )}
        </div>
      </div>

      {jobs.length === 0 ? (
        <div className="text-center py-12">
          <RotateCcw className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-500">No render jobs in queue</p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Statistics */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <div className="text-2xl font-bold text-yellow-800">{pendingJobs.length}</div>
              <div className="text-sm text-yellow-600">Pending</div>
            </div>
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="text-2xl font-bold text-blue-800">{runningJobs.length}</div>
              <div className="text-sm text-blue-600">Running</div>
            </div>
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <div className="text-2xl font-bold text-green-800">{completedJobs.length}</div>
              <div className="text-sm text-green-600">Completed</div>
            </div>
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <div className="text-2xl font-bold text-red-800">{failedJobs.length}</div>
              <div className="text-sm text-red-600">Failed</div>
            </div>
          </div>

          {/* Job Cards */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {jobs.map(job => (
              <RenderJobCard key={job.id} job={job} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}