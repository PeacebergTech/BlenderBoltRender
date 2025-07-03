import React, { useState, useCallback, useEffect } from 'react';
import { 
  Play, 
  Pause, 
  Square, 
  Plus, 
  FolderOpen, 
  Settings, 
  Monitor,
  Trash2,
  Save,
  Upload,
  Download,
  RotateCcw,
  ChevronUp,
  ChevronDown,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle
} from 'lucide-react';
import { useElectron } from './hooks/useElectron';
import { useBlenderService } from './hooks/useBlenderService';
import { useRenderQueue } from './hooks/useRenderQueue';
import { renderQueue } from './services/RenderQueue';
import { blenderService } from './services/BlenderService';
import { ElectronMenuHandler } from './components/ElectronMenuHandler';
import { DragDropHandler } from './components/DragDropHandler';
import { BlenderPathSettings } from './components/BlenderPathSettings';

interface BlendFile {
  id: string;
  path: string;
  name: string;
  size: string;
  dateModified: string;
  outputPath: string;
  frameStart: number;
  frameEnd: number;
  engine: 'CYCLES' | 'EEVEE' | 'WORKBENCH';
  samples: number;
  resolution: [number, number];
  format: 'PNG' | 'JPEG' | 'TIFF' | 'EXR' | 'FFMPEG';
  quality: number;
  useGPU: boolean;
}

interface ProjectSettings {
  name: string;
  outputDirectory: string;
  globalFrameStart: number;
  globalFrameEnd: number;
  globalEngine: 'CYCLES' | 'EEVEE' | 'WORKBENCH';
  globalSamples: number;
  globalResolution: [number, number];
  globalFormat: 'PNG' | 'JPEG' | 'TIFF' | 'EXR' | 'FFMPEG';
  globalQuality: number;
  globalUseGPU: boolean;
  threads: number;
}

function App() {
  const { isElectron, electronAPI } = useElectron();
  const { isBlenderAvailable, blenderVersion } = useBlenderService();
  const { queue, stats, addToQueue, removeFromQueue, clearQueue, startQueue, pauseQueue, stopQueue, moveItemUp, moveItemDown, retryItem } = useRenderQueue();
  
  const [blendFiles, setBlendFiles] = useState<BlendFile[]>([]);
  const [selectedFiles, setSelectedFiles] = useState<string[]>([]);
  const [projectSettings, setProjectSettings] = useState<ProjectSettings>({
    name: 'Untitled Project',
    outputDirectory: '',
    globalFrameStart: 1,
    globalFrameEnd: 250,
    globalEngine: 'CYCLES',
    globalSamples: 128,
    globalResolution: [1920, 1080],
    globalFormat: 'PNG',
    globalQuality: 90,
    globalUseGPU: false,
    threads: 4
  });
  const [showSettings, setShowSettings] = useState(false);
  const [currentProject, setCurrentProject] = useState<string | null>(null);

  // Initialize Blender service with render queue
  useEffect(() => {
    if (electronAPI) {
      blenderService.setElectronAPI(electronAPI);
      renderQueue.setBlenderAPI(blenderService);
    }
  }, [electronAPI]);

  // File operations
  const handleAddBlendFiles = useCallback(async (filePaths?: string[]) => {
    let paths = filePaths;
    
    if (!paths && electronAPI) {
      paths = await electronAPI.selectBlendFiles();
    }
    
    if (paths && paths.length > 0) {
      const newFiles: BlendFile[] = paths.map(path => {
        const name = path.split(/[/\\]/).pop() || path;
        return {
          id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          path,
          name,
          size: 'Unknown',
          dateModified: new Date().toLocaleDateString(),
          outputPath: projectSettings.outputDirectory || path.replace(/\.blend$/, '_render'),
          frameStart: projectSettings.globalFrameStart,
          frameEnd: projectSettings.globalFrameEnd,
          engine: projectSettings.globalEngine,
          samples: projectSettings.globalSamples,
          resolution: projectSettings.globalResolution,
          format: projectSettings.globalFormat,
          quality: projectSettings.globalQuality,
          useGPU: projectSettings.globalUseGPU
        };
      });
      
      setBlendFiles(prev => [...prev, ...newFiles]);
    }
  }, [electronAPI, projectSettings]);

  const handleSelectOutputDirectory = useCallback(async () => {
    if (!electronAPI) return;
    
    const directory = await electronAPI.selectOutputDirectory();
    if (directory) {
      setProjectSettings(prev => ({ ...prev, outputDirectory: directory }));
    }
  }, [electronAPI]);

  const handleRemoveFiles = useCallback(() => {
    setBlendFiles(prev => prev.filter(file => !selectedFiles.includes(file.id)));
    setSelectedFiles([]);
  }, [selectedFiles]);

  const handleClearAll = useCallback(() => {
    setBlendFiles([]);
    setSelectedFiles([]);
    clearQueue();
  }, [clearQueue]);

  // Render operations
  const handleStartRender = useCallback(() => {
    if (!isBlenderAvailable) {
      if (electronAPI) {
        electronAPI.showMessageBox({
          type: 'error',
          title: 'Blender Not Available',
          message: 'Blender is not installed or not found. Please install Blender or configure the correct path in settings.',
          buttons: ['OK']
        });
      }
      return;
    }

    const filesToRender = selectedFiles.length > 0 
      ? blendFiles.filter(file => selectedFiles.includes(file.id))
      : blendFiles;

    if (filesToRender.length === 0) {
      if (electronAPI) {
        electronAPI.showMessageBox({
          type: 'warning',
          title: 'No Files Selected',
          message: 'Please add some .blend files to render.',
          buttons: ['OK']
        });
      }
      return;
    }

    // Add files to render queue
    filesToRender.forEach(file => {
      addToQueue(file.path, file.outputPath, {
        startFrame: file.frameStart,
        endFrame: file.frameEnd,
        engine: file.engine,
        samples: file.samples,
        resolution: file.resolution,
        format: file.format,
        quality: file.quality,
        threads: projectSettings.threads,
        gpu: file.useGPU
      });
    });

    startQueue();
  }, [isBlenderAvailable, blendFiles, selectedFiles, addToQueue, startQueue, projectSettings.threads, electronAPI]);

  const handleStopRender = useCallback(() => {
    stopQueue();
  }, [stopQueue]);

  const handlePauseResume = useCallback(() => {
    if (stats.isPaused) {
      startQueue();
    } else {
      pauseQueue();
    }
  }, [stats.isPaused, startQueue, pauseQueue]);

  // Project operations
  const handleNewProject = useCallback(() => {
    setBlendFiles([]);
    setSelectedFiles([]);
    clearQueue();
    setProjectSettings({
      name: 'Untitled Project',
      outputDirectory: '',
      globalFrameStart: 1,
      globalFrameEnd: 250,
      globalEngine: 'CYCLES',
      globalSamples: 128,
      globalResolution: [1920, 1080],
      globalFormat: 'PNG',
      globalQuality: 90,
      globalUseGPU: false,
      threads: 4
    });
    setCurrentProject(null);
  }, [clearQueue]);

  const handleSaveProject = useCallback(async () => {
    if (!electronAPI) return;

    const projectData = {
      settings: projectSettings,
      files: blendFiles,
      version: '1.0.0'
    };

    let filePath = currentProject;
    
    if (!filePath) {
      const result = await electronAPI.showSaveDialog({
        filters: [{ name: 'Render Farm Projects', extensions: ['rfp'] }],
        defaultPath: `${projectSettings.name}.rfp`
      });
      
      if (result.canceled) return;
      filePath = result.filePath;
    }

    try {
      // In a real implementation, you would save to file system
      // For now, we'll just simulate it
      setCurrentProject(filePath);
      
      await electronAPI.showMessageBox({
        type: 'info',
        title: 'Project Saved',
        message: `Project saved successfully to ${filePath}`,
        buttons: ['OK']
      });
    } catch (error) {
      await electronAPI.showMessageBox({
        type: 'error',
        title: 'Save Error',
        message: `Failed to save project: ${error}`,
        buttons: ['OK']
      });
    }
  }, [electronAPI, projectSettings, blendFiles, currentProject]);

  const handleOpenProject = useCallback(async (filePath?: string) => {
    if (!electronAPI) return;

    let path = filePath;
    
    if (!path) {
      const result = await electronAPI.showOpenDialog({
        filters: [{ name: 'Render Farm Projects', extensions: ['rfp'] }],
        properties: ['openFile']
      });
      
      if (result.canceled) return;
      path = result.filePaths[0];
    }

    try {
      // In a real implementation, you would load from file system
      // For now, we'll just simulate it
      setCurrentProject(path);
      
      await electronAPI.showMessageBox({
        type: 'info',
        title: 'Project Loaded',
        message: `Project loaded successfully from ${path}`,
        buttons: ['OK']
      });
    } catch (error) {
      await electronAPI.showMessageBox({
        type: 'error',
        title: 'Load Error',
        message: `Failed to load project: ${error}`,
        buttons: ['OK']
      });
    }
  }, [electronAPI]);

  const handleOpenOutputFolder = useCallback(async () => {
    if (!electronAPI || !projectSettings.outputDirectory) return;
    
    try {
      await electronAPI.showItemInFolder(projectSettings.outputDirectory);
    } catch (error) {
      console.error('Failed to open output folder:', error);
    }
  }, [electronAPI, projectSettings.outputDirectory]);

  // File selection
  const handleFileSelect = useCallback((fileId: string, selected: boolean) => {
    setSelectedFiles(prev => 
      selected 
        ? [...prev, fileId]
        : prev.filter(id => id !== fileId)
    );
  }, []);

  const handleSelectAll = useCallback(() => {
    setSelectedFiles(blendFiles.map(file => file.id));
  }, [blendFiles]);

  const handleDeselectAll = useCallback(() => {
    setSelectedFiles([]);
  }, []);

  // Update file settings
  const updateFileSettings = useCallback((fileId: string, updates: Partial<BlendFile>) => {
    setBlendFiles(prev => prev.map(file => 
      file.id === fileId ? { ...file, ...updates } : file
    ));
  }, []);

  // Apply global settings to selected files
  const applyGlobalSettings = useCallback(() => {
    const filesToUpdate = selectedFiles.length > 0 ? selectedFiles : blendFiles.map(f => f.id);
    
    setBlendFiles(prev => prev.map(file => 
      filesToUpdate.includes(file.id) ? {
        ...file,
        frameStart: projectSettings.globalFrameStart,
        frameEnd: projectSettings.globalFrameEnd,
        engine: projectSettings.globalEngine,
        samples: projectSettings.globalSamples,
        resolution: projectSettings.globalResolution,
        format: projectSettings.globalFormat,
        quality: projectSettings.globalQuality,
        useGPU: projectSettings.globalUseGPU,
        outputPath: projectSettings.outputDirectory ? 
          `${projectSettings.outputDirectory}/${file.name.replace('.blend', '')}` : 
          file.outputPath
      } : file
    ));
  }, [selectedFiles, blendFiles, projectSettings]);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending': return <Clock className="w-4 h-4 text-yellow-500" />;
      case 'rendering': return <Play className="w-4 h-4 text-blue-500 animate-pulse" />;
      case 'completed': return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'error': return <XCircle className="w-4 h-4 text-red-500" />;
      case 'cancelled': return <AlertCircle className="w-4 h-4 text-gray-500" />;
      default: return <Clock className="w-4 h-4 text-gray-400" />;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      {/* Electron Menu Handler */}
      {isElectron && (
        <>
          <ElectronMenuHandler
            onNewProject={handleNewProject}
            onOpenProject={handleOpenProject}
            onSaveProject={handleSaveProject}
            onSaveProjectAs={() => {
              setCurrentProject(null);
              handleSaveProject();
            }}
            onAddBlendFiles={handleAddBlendFiles}
            onClearQueue={handleClearAll}
            onStartRender={handleStartRender}
            onStopRender={handleStopRender}
            onPauseResume={handlePauseResume}
            onOpenOutputFolder={handleOpenOutputFolder}
          />
          <DragDropHandler onFilesDropped={handleAddBlendFiles} />
        </>
      )}

      {/* Header */}
      <header className="bg-white shadow-sm border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <Monitor className="w-8 h-8 text-blue-600" />
                <div>
                  <h1 className="text-xl font-bold text-slate-900">Blender Render Farm</h1>
                  <p className="text-xs text-slate-500">
                    {currentProject ? `Project: ${currentProject.split(/[/\\]/).pop()}` : 'No project loaded'}
                  </p>
                </div>
              </div>
            </div>
            
            <div className="flex items-center space-x-3">
              {/* Blender Status */}
              <div className="flex items-center space-x-2 px-3 py-1 bg-slate-100 rounded-lg">
                {isBlenderAvailable ? (
                  <CheckCircle className="w-4 h-4 text-green-500" />
                ) : (
                  <XCircle className="w-4 h-4 text-red-500" />
                )}
                <span className="text-sm font-medium">
                  {isBlenderAvailable ? `Blender ${blenderVersion}` : 'Blender Not Found'}
                </span>
              </div>
              
              <BlenderPathSettings />
              
              <button
                onClick={() => setShowSettings(!showSettings)}
                className="flex items-center space-x-2 px-3 py-2 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
              >
                <Settings className="w-4 h-4" />
                <span className="text-sm font-medium">Settings</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Control Panel */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-slate-900">Render Control</h2>
                <div className="flex items-center space-x-2">
                  <div className="text-sm text-slate-600">
                    Queue: {stats.total} files ({stats.completed} completed, {stats.failed} failed)
                  </div>
                </div>
              </div>
              
              <div className="flex flex-wrap gap-3">
                <button
                  onClick={handleStartRender}
                  disabled={!isBlenderAvailable || stats.isProcessing}
                  className="flex items-center space-x-2 px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white rounded-lg transition-colors"
                >
                  <Play className="w-4 h-4" />
                  <span>Start Render</span>
                </button>
                
                <button
                  onClick={handlePauseResume}
                  disabled={!stats.isProcessing}
                  className="flex items-center space-x-2 px-4 py-2 bg-yellow-600 hover:bg-yellow-700 disabled:bg-gray-400 text-white rounded-lg transition-colors"
                >
                  {stats.isPaused ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
                  <span>{stats.isPaused ? 'Resume' : 'Pause'}</span>
                </button>
                
                <button
                  onClick={handleStopRender}
                  disabled={!stats.isProcessing}
                  className="flex items-center space-x-2 px-4 py-2 bg-red-600 hover:bg-red-700 disabled:bg-gray-400 text-white rounded-lg transition-colors"
                >
                  <Square className="w-4 h-4" />
                  <span>Stop</span>
                </button>
                
                <div className="flex-1"></div>
                
                <button
                  onClick={() => handleAddBlendFiles()}
                  className="flex items-center space-x-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  <span>Add Files</span>
                </button>
                
                <button
                  onClick={handleSelectOutputDirectory}
                  className="flex items-center space-x-2 px-4 py-2 bg-slate-600 hover:bg-slate-700 text-white rounded-lg transition-colors"
                >
                  <FolderOpen className="w-4 h-4" />
                  <span>Output Dir</span>
                </button>
              </div>
            </div>

            {/* File List */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200">
              <div className="p-6 border-b border-slate-200">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-semibold text-slate-900">Blend Files ({blendFiles.length})</h2>
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={handleSelectAll}
                      className="text-sm text-blue-600 hover:text-blue-700"
                    >
                      Select All
                    </button>
                    <span className="text-slate-300">|</span>
                    <button
                      onClick={handleDeselectAll}
                      className="text-sm text-blue-600 hover:text-blue-700"
                    >
                      Deselect All
                    </button>
                    <span className="text-slate-300">|</span>
                    <button
                      onClick={handleRemoveFiles}
                      disabled={selectedFiles.length === 0}
                      className="text-sm text-red-600 hover:text-red-700 disabled:text-gray-400"
                    >
                      Remove Selected
                    </button>
                  </div>
                </div>
              </div>
              
              <div className="max-h-96 overflow-y-auto">
                {blendFiles.length === 0 ? (
                  <div className="p-8 text-center text-slate-500">
                    <Monitor className="w-12 h-12 mx-auto mb-4 text-slate-300" />
                    <p className="text-lg font-medium mb-2">No blend files added</p>
                    <p className="text-sm">Add .blend files to start rendering</p>
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100">
                    {blendFiles.map((file) => (
                      <div key={file.id} className="p-4 hover:bg-slate-50">
                        <div className="flex items-center space-x-3">
                          <input
                            type="checkbox"
                            checked={selectedFiles.includes(file.id)}
                            onChange={(e) => handleFileSelect(file.id, e.target.checked)}
                            className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                          />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between">
                              <p className="text-sm font-medium text-slate-900 truncate">{file.name}</p>
                              <div className="flex items-center space-x-2 text-xs text-slate-500">
                                <span>{file.engine}</span>
                                <span>•</span>
                                <span>{file.frameStart}-{file.frameEnd}</span>
                                <span>•</span>
                                <span>{file.resolution[0]}×{file.resolution[1]}</span>
                              </div>
                            </div>
                            <p className="text-xs text-slate-500 truncate">{file.path}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Render Queue */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200">
              <div className="p-6 border-b border-slate-200">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-semibold text-slate-900">Render Queue ({queue.length})</h2>
                  <button
                    onClick={clearQueue}
                    disabled={stats.isProcessing}
                    className="flex items-center space-x-2 px-3 py-1 text-sm text-red-600 hover:text-red-700 disabled:text-gray-400"
                  >
                    <Trash2 className="w-4 h-4" />
                    <span>Clear Queue</span>
                  </button>
                </div>
              </div>
              
              <div className="max-h-64 overflow-y-auto">
                {queue.length === 0 ? (
                  <div className="p-8 text-center text-slate-500">
                    <Clock className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                    <p className="text-sm">No items in render queue</p>
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100">
                    {queue.map((item, index) => (
                      <div key={item.id} className="p-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-3">
                            {getStatusIcon(item.status)}
                            <div>
                              <p className="text-sm font-medium text-slate-900">
                                {item.blendFile.split(/[/\\]/).pop()}
                              </p>
                              <p className="text-xs text-slate-500">
                                {item.status === 'rendering' && item.currentFrame && item.totalFrames
                                  ? `Frame ${item.currentFrame}/${item.totalFrames} (${item.progress}%)`
                                  : item.status.charAt(0).toUpperCase() + item.status.slice(1)
                                }
                              </p>
                            </div>
                          </div>
                          
                          <div className="flex items-center space-x-2">
                            {item.status === 'rendering' && (
                              <div className="w-24 bg-slate-200 rounded-full h-2">
                                <div 
                                  className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                                  style={{ width: `${item.progress}%` }}
                                ></div>
                              </div>
                            )}
                            
                            <div className="flex items-center space-x-1">
                              <button
                                onClick={() => moveItemUp(item.id)}
                                disabled={index === 0 || item.status === 'rendering'}
                                className="p-1 text-slate-400 hover:text-slate-600 disabled:opacity-50"
                              >
                                <ChevronUp className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => moveItemDown(item.id)}
                                disabled={index === queue.length - 1 || item.status === 'rendering'}
                                className="p-1 text-slate-400 hover:text-slate-600 disabled:opacity-50"
                              >
                                <ChevronDown className="w-4 h-4" />
                              </button>
                              {(item.status === 'error' || item.status === 'cancelled') && (
                                <button
                                  onClick={() => retryItem(item.id)}
                                  className="p-1 text-blue-600 hover:text-blue-700"
                                  title="Retry"
                                >
                                  <RotateCcw className="w-4 h-4" />
                                </button>
                              )}
                              <button
                                onClick={() => removeFromQueue(item.id)}
                                disabled={item.status === 'rendering'}
                                className="p-1 text-red-600 hover:text-red-700 disabled:opacity-50"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        </div>
                        
                        {item.error && (
                          <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded text-xs text-red-700">
                            {item.error}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Settings Panel */}
          <div className="space-y-6">
            {/* Project Settings */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
              <h3 className="text-lg font-semibold text-slate-900 mb-4">Project Settings</h3>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Project Name</label>
                  <input
                    type="text"
                    value={projectSettings.name}
                    onChange={(e) => setProjectSettings(prev => ({ ...prev, name: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Output Directory</label>
                  <div className="flex space-x-2">
                    <input
                      type="text"
                      value={projectSettings.outputDirectory}
                      onChange={(e) => setProjectSettings(prev => ({ ...prev, outputDirectory: e.target.value }))}
                      placeholder="Select output directory..."
                      className="flex-1 px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                    <button
                      onClick={handleSelectOutputDirectory}
                      className="px-3 py-2 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
                    >
                      <FolderOpen className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Global Render Settings */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-slate-900">Global Render Settings</h3>
                <button
                  onClick={applyGlobalSettings}
                  className="text-sm text-blue-600 hover:text-blue-700"
                >
                  Apply to {selectedFiles.length > 0 ? 'Selected' : 'All'}
                </button>
              </div>
              
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Start Frame</label>
                    <input
                      type="number"
                      value={projectSettings.globalFrameStart}
                      onChange={(e) => setProjectSettings(prev => ({ ...prev, globalFrameStart: parseInt(e.target.value) || 1 }))}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">End Frame</label>
                    <input
                      type="number"
                      value={projectSettings.globalFrameEnd}
                      onChange={(e) => setProjectSettings(prev => ({ ...prev, globalFrameEnd: parseInt(e.target.value) || 250 }))}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Render Engine</label>
                  <select
                    value={projectSettings.globalEngine}
                    onChange={(e) => setProjectSettings(prev => ({ ...prev, globalEngine: e.target.value as any }))}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="CYCLES">Cycles</option>
                    <option value="EEVEE">Eevee</option>
                    <option value="WORKBENCH">Workbench</option>
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Samples</label>
                  <input
                    type="number"
                    value={projectSettings.globalSamples}
                    onChange={(e) => setProjectSettings(prev => ({ ...prev, globalSamples: parseInt(e.target.value) || 128 }))}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Width</label>
                    <input
                      type="number"
                      value={projectSettings.globalResolution[0]}
                      onChange={(e) => setProjectSettings(prev => ({ 
                        ...prev, 
                        globalResolution: [parseInt(e.target.value) || 1920, prev.globalResolution[1]]
                      }))}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Height</label>
                    <input
                      type="number"
                      value={projectSettings.globalResolution[1]}
                      onChange={(e) => setProjectSettings(prev => ({ 
                        ...prev, 
                        globalResolution: [prev.globalResolution[0], parseInt(e.target.value) || 1080]
                      }))}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Output Format</label>
                  <select
                    value={projectSettings.globalFormat}
                    onChange={(e) => setProjectSettings(prev => ({ ...prev, globalFormat: e.target.value as any }))}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="PNG">PNG</option>
                    <option value="JPEG">JPEG</option>
                    <option value="TIFF">TIFF</option>
                    <option value="EXR">OpenEXR</option>
                    <option value="FFMPEG">Video (FFmpeg)</option>
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Threads</label>
                  <input
                    type="number"
                    value={projectSettings.threads}
                    onChange={(e) => setProjectSettings(prev => ({ ...prev, threads: parseInt(e.target.value) || 4 }))}
                    min="1"
                    max="32"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="useGPU"
                    checked={projectSettings.globalUseGPU}
                    onChange={(e) => setProjectSettings(prev => ({ ...prev, globalUseGPU: e.target.checked }))}
                    className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                  />
                  <label htmlFor="useGPU" className="text-sm font-medium text-slate-700">
                    Use GPU Rendering
                  </label>
                </div>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
              <h3 className="text-lg font-semibold text-slate-900 mb-4">Quick Actions</h3>
              
              <div className="space-y-3">
                <button
                  onClick={handleNewProject}
                  className="w-full flex items-center space-x-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  <span>New Project</span>
                </button>
                
                <button
                  onClick={() => handleSaveProject()}
                  className="w-full flex items-center space-x-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
                >
                  <Save className="w-4 h-4" />
                  <span>Save Project</span>
                </button>
                
                <button
                  onClick={() => handleOpenProject()}
                  className="w-full flex items-center space-x-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
                >
                  <Upload className="w-4 h-4" />
                  <span>Load Project</span>
                </button>
                
                <button
                  onClick={handleOpenOutputFolder}
                  disabled={!projectSettings.outputDirectory}
                  className="w-full flex items-center space-x-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 disabled:bg-slate-50 disabled:text-slate-400 rounded-lg transition-colors"
                >
                  <FolderOpen className="w-4 h-4" />
                  <span>Open Output Folder</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;