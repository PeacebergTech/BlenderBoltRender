import React from 'react';
import { Play, Pause, X, FolderOpen, Clock, CheckCircle, XCircle, AlertCircle } from 'lucide-react';
import { useElectron } from '../hooks/useElectron';

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

interface RenderJobCardProps {
  job: RenderJob;
}

export function RenderJobCard({ job }: RenderJobCardProps) {
  const { electronAPI } = useElectron();

  const getStatusIcon = () => {
    switch (job.status) {
      case 'pending':
        return <Clock className="w-5 h-5 text-yellow-500" />;
      case 'running':
        return <Play className="w-5 h-5 text-blue-500" />;
      case 'completed':
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'failed':
        return <XCircle className="w-5 h-5 text-red-500" />;
      case 'cancelled':
        return <AlertCircle className="w-5 h-5 text-gray-500" />;
      default:
        return <Clock className="w-5 h-5 text-gray-500" />;
    }
  };

  const getStatusColor = () => {
    switch (job.status) {
      case 'pending':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'running':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'completed':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'failed':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'cancelled':
        return 'bg-gray-100 text-gray-800 border-gray-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const handleCancel = () => {
    if (electronAPI && job.status === 'running') {
      electronAPI.cancelJob(job.id);
    }
  };

  const handleRemove = () => {
    if (electronAPI) {
      electronAPI.removeJob(job.id);
    }
  };

  const handleOpenOutput = () => {
    if (electronAPI) {
      electronAPI.openOutputFolder(job.outputPath);
    }
  };

  const formatDuration = (start: string, end?: string) => {
    const startTime = new Date(start);
    const endTime = end ? new Date(end) : new Date();
    const duration = Math.floor((endTime.getTime() - startTime.getTime()) / 1000);
    
    const hours = Math.floor(duration / 3600);
    const minutes = Math.floor((duration % 3600) / 60);
    const seconds = duration % 60;
    
    if (hours > 0) {
      return `${hours}h ${minutes}m ${seconds}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds}s`;
    } else {
      return `${seconds}s`;
    }
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center space-x-3">
          {getStatusIcon()}
          <div>
            <h3 className="font-semibold text-gray-900 truncate max-w-xs">
              {job.blendFile.split('/').pop() || job.blendFile.split('\\').pop()}
            </h3>
            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${getStatusColor()}`}>
              {job.status.charAt(0).toUpperCase() + job.status.slice(1)}
            </span>
          </div>
        </div>
        
        <div className="flex items-center space-x-2">
          {job.status === 'completed' && (
            <button
              onClick={handleOpenOutput}
              className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
              title="Open output folder"
            >
              <FolderOpen className="w-4 h-4" />
            </button>
          )}
          
          {job.status === 'running' && (
            <button
              onClick={handleCancel}
              className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
              title="Cancel render"
            >
              <Pause className="w-4 h-4" />
            </button>
          )}
          
          {(job.status === 'completed' || job.status === 'failed' || job.status === 'cancelled') && (
            <button
              onClick={handleRemove}
              className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
              title="Remove job"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      <div className="space-y-3">
        <div className="text-sm text-gray-600">
          <div className="flex justify-between">
            <span>Frames:</span>
            <span>{job.startFrame} - {job.endFrame}</span>
          </div>
          <div className="flex justify-between">
            <span>Output:</span>
            <span className="truncate max-w-xs ml-2" title={job.outputPath}>
              {job.outputPath.split('/').pop() || job.outputPath.split('\\').pop()}
            </span>
          </div>
          <div className="flex justify-between">
            <span>Duration:</span>
            <span>{formatDuration(job.createdAt, job.completedAt)}</span>
          </div>
        </div>

        {job.status === 'running' && (
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>Progress</span>
              <span>{job.progress}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${job.progress}%` }}
              />
            </div>
          </div>
        )}

        {job.error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm text-red-700">{job.error}</p>
          </div>
        )}
      </div>
    </div>
  );
}