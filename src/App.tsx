import React, { useState, useEffect, useRef } from 'react';
import { Upload, Play, Pause, Trash2, Download, Settings, Monitor, Clock, CheckCircle, XCircle, AlertCircle } from 'lucide-react';

interface RenderJob {
  id: string;
  filename: string;
  status: 'queued' | 'rendering' | 'completed' | 'failed' | 'cancelled';
  progress: number;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  error?: string;
  outputFiles: Array<{
    name: string;
    url: string;
    size: number;
  }>;
  settings: {
    frame: number;
    device: string;
    samples: number;
    resolution: string;
  };
}

interface SystemInfo {
  blenderAvailable: boolean;
  activeJobs: number;
  queuedJobs: number;
  totalJobs: number;
}

function App() {
  const [jobs, setJobs] = useState<RenderJob[]>([]);
  const [systemInfo, setSystemInfo] = useState<SystemInfo | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadedFile, setUploadedFile] = useState<string | null>(null);
  const [renderSettings, setRenderSettings] = useState({
    frame: 1,
    device: 'CPU',
    samples: 128,
    resolution: '1920x1080'
  });
  const [isUploading, setIsUploading] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    // Connect to WebSocket
    const ws = new WebSocket('ws://localhost:3001');
    wsRef.current = ws;

    ws.onopen = () => {
      console.log('Connected to render farm server');
    };

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      
      if (data.type === 'jobUpdate') {
        setJobs(prev => {
          const updated = prev.map(job => 
            job.id === data.job.id ? data.job : job
          );
          
          // Add new job if not exists
          if (!prev.find(job => job.id === data.job.id)) {
            updated.push(data.job);
          }
          
          return updated.sort((a, b) => 
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
          );
        });
      } else if (data.type === 'jobsList') {
        setJobs(data.jobs);
      }
    };

    ws.onclose = () => {
      console.log('Disconnected from render farm server');
    };

    // Fetch system info
    fetchSystemInfo();

    return () => {
      ws.close();
    };
  }, []);

  const fetchSystemInfo = async () => {
    try {
      const response = await fetch('http://localhost:3001/api/system');
      const data = await response.json();
      setSystemInfo(data);
    } catch (error) {
      console.error('Failed to fetch system info:', error);
    }
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && file.name.endsWith('.blend')) {
      setSelectedFile(file);
    } else {
      alert('Please select a .blend file');
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) return;

    setIsUploading(true);
    const formData = new FormData();
    formData.append('blendFile', selectedFile);

    try {
      const response = await fetch('http://localhost:3001/api/upload', {
        method: 'POST',
        body: formData
      });

      const data = await response.json();
      if (data.success) {
        setUploadedFile(data.file.filename);
        setSelectedFile(null);
      } else {
        alert('Upload failed: ' + data.error);
      }
    } catch (error) {
      alert('Upload failed: ' + error);
    } finally {
      setIsUploading(false);
    }
  };

  const handleStartRender = async () => {
    if (!uploadedFile) return;

    try {
      const response = await fetch('http://localhost:3001/api/render', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          filename: uploadedFile,
          settings: renderSettings
        })
      });

      const data = await response.json();
      if (data.success) {
        setUploadedFile(null);
        fetchSystemInfo();
      } else {
        alert('Failed to start render: ' + data.error);
      }
    } catch (error) {
      alert('Failed to start render: ' + error);
    }
  };

  const handleCancelJob = async (jobId: string) => {
    try {
      const response = await fetch(`http://localhost:3001/api/jobs/${jobId}`, {
        method: 'DELETE'
      });

      if (!response.ok) {
        alert('Failed to cancel job');
      }
    } catch (error) {
      alert('Failed to cancel job: ' + error);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'queued':
        return <Clock className="w-5 h-5 text-yellow-500" />;
      case 'rendering':
        return <Monitor className="w-5 h-5 text-blue-500 animate-pulse" />;
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

  const formatDuration = (start: string, end?: string) => {
    const startTime = new Date(start).getTime();
    const endTime = end ? new Date(end).getTime() : Date.now();
    const duration = Math.floor((endTime - startTime) / 1000);
    
    const minutes = Math.floor(duration / 60);
    const seconds = duration % 60;
    
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      <div className="container mx-auto px-6 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-white mb-2">
            Blender Render Farm
          </h1>
          <p className="text-slate-300">
            Professional batch rendering with real-time monitoring
          </p>
        </div>

        {/* System Status */}
        {systemInfo && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 border border-white/20">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-slate-300 text-sm">Blender Status</p>
                  <p className={`font-semibold ${systemInfo.blenderAvailable ? 'text-green-400' : 'text-red-400'}`}>
                    {systemInfo.blenderAvailable ? 'Available' : 'Not Found'}
                  </p>
                </div>
                <Monitor className="w-8 h-8 text-blue-400" />
              </div>
            </div>
            
            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 border border-white/20">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-slate-300 text-sm">Active Jobs</p>
                  <p className="text-2xl font-bold text-white">{systemInfo.activeJobs}</p>
                </div>
                <Play className="w-8 h-8 text-green-400" />
              </div>
            </div>
            
            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 border border-white/20">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-slate-300 text-sm">Queued Jobs</p>
                  <p className="text-2xl font-bold text-white">{systemInfo.queuedJobs}</p>
                </div>
                <Clock className="w-8 h-8 text-yellow-400" />
              </div>
            </div>
            
            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 border border-white/20">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-slate-300 text-sm">Total Jobs</p>
                  <p className="text-2xl font-bold text-white">{systemInfo.totalJobs}</p>
                </div>
                <Settings className="w-8 h-8 text-purple-400" />
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Upload & Settings Panel */}
          <div className="lg:col-span-1">
            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6 border border-white/20">
              <h2 className="text-xl font-semibold text-white mb-6">New Render Job</h2>
              
              {/* File Upload */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Blender File (.blend)
                </label>
                <div className="border-2 border-dashed border-white/30 rounded-lg p-4 text-center hover:border-white/50 transition-colors">
                  <input
                    type="file"
                    accept=".blend"
                    onChange={handleFileSelect}
                    className="hidden"
                    id="file-upload"
                  />
                  <label htmlFor="file-upload" className="cursor-pointer">
                    <Upload className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                    <p className="text-slate-300">
                      {selectedFile ? selectedFile.name : 'Click to select .blend file'}
                    </p>
                  </label>
                </div>
                
                {selectedFile && (
                  <button
                    onClick={handleUpload}
                    disabled={isUploading}
                    className="w-full mt-3 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 text-white py-2 px-4 rounded-lg transition-colors"
                  >
                    {isUploading ? 'Uploading...' : 'Upload File'}
                  </button>
                )}
              </div>

              {/* Render Settings */}
              {uploadedFile && (
                <div className="space-y-4">
                  <h3 className="text-lg font-medium text-white">Render Settings</h3>
                  
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-1">
                      Frame Number
                    </label>
                    <input
                      type="number"
                      value={renderSettings.frame}
                      onChange={(e) => setRenderSettings(prev => ({ ...prev, frame: parseInt(e.target.value) }))}
                      className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white"
                      min="1"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-1">
                      Device
                    </label>
                    <select
                      value={renderSettings.device}
                      onChange={(e) => setRenderSettings(prev => ({ ...prev, device: e.target.value }))}
                      className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white"
                    >
                      <option value="CPU">CPU</option>
                      <option value="CUDA">CUDA (GPU)</option>
                      <option value="OPENCL">OpenCL (GPU)</option>
                    </select>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-1">
                      Samples
                    </label>
                    <input
                      type="number"
                      value={renderSettings.samples}
                      onChange={(e) => setRenderSettings(prev => ({ ...prev, samples: parseInt(e.target.value) }))}
                      className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white"
                      min="1"
                      max="4096"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-1">
                      Resolution
                    </label>
                    <select
                      value={renderSettings.resolution}
                      onChange={(e) => setRenderSettings(prev => ({ ...prev, resolution: e.target.value }))}
                      className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white"
                    >
                      <option value="1920x1080">1920x1080 (Full HD)</option>
                      <option value="2560x1440">2560x1440 (2K)</option>
                      <option value="3840x2160">3840x2160 (4K)</option>
                      <option value="1280x720">1280x720 (HD)</option>
                    </select>
                  </div>
                  
                  <button
                    onClick={handleStartRender}
                    className="w-full bg-green-600 hover:bg-green-700 text-white py-3 px-4 rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
                  >
                    <Play className="w-5 h-5" />
                    Start Render
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Jobs List */}
          <div className="lg:col-span-2">
            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6 border border-white/20">
              <h2 className="text-xl font-semibold text-white mb-6">Render Jobs</h2>
              
              <div className="space-y-4">
                {jobs.length === 0 ? (
                  <div className="text-center py-8">
                    <Monitor className="w-12 h-12 text-slate-400 mx-auto mb-3" />
                    <p className="text-slate-400">No render jobs yet</p>
                  </div>
                ) : (
                  jobs.map((job) => (
                    <div key={job.id} className="bg-white/5 rounded-lg p-4 border border-white/10">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-3">
                          {getStatusIcon(job.status)}
                          <div>
                            <h3 className="font-medium text-white">{job.filename}</h3>
                            <p className="text-sm text-slate-400">
                              Frame {job.settings.frame} • {job.settings.device} • {job.settings.samples} samples
                            </p>
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-2">
                          {job.status === 'queued' && (
                            <button
                              onClick={() => handleCancelJob(job.id)}
                              className="p-2 text-red-400 hover:bg-red-400/20 rounded-lg transition-colors"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                          
                          {job.outputFiles.length > 0 && (
                            <div className="flex gap-1">
                              {job.outputFiles.map((file, index) => (
                                <a
                                  key={index}
                                  href={`http://localhost:3001${file.url}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="p-2 text-green-400 hover:bg-green-400/20 rounded-lg transition-colors"
                                >
                                  <Download className="w-4 h-4" />
                                </a>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                      
                      {/* Progress Bar */}
                      {job.status === 'rendering' && (
                        <div className="mb-3">
                          <div className="flex justify-between text-sm text-slate-400 mb-1">
                            <span>Progress</span>
                            <span>{job.progress.toFixed(1)}%</span>
                          </div>
                          <div className="w-full bg-white/10 rounded-full h-2">
                            <div
                              className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                              style={{ width: `${job.progress}%` }}
                            />
                          </div>
                        </div>
                      )}
                      
                      {/* Job Info */}
                      <div className="flex justify-between text-sm text-slate-400">
                        <span>
                          {job.status === 'rendering' && job.startedAt && (
                            <>Running for {formatDuration(job.startedAt)}</>
                          )}
                          {job.status === 'completed' && job.startedAt && job.completedAt && (
                            <>Completed in {formatDuration(job.startedAt, job.completedAt)}</>
                          )}
                          {job.status === 'queued' && (
                            <>Queued {formatDuration(job.createdAt)} ago</>
                          )}
                          {job.status === 'failed' && job.error && (
                            <span className="text-red-400">Error: {job.error}</span>
                          )}
                        </span>
                        <span className="capitalize">{job.status}</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;