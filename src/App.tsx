import React, { useState, useCallback, useRef, useEffect } from 'react';
import { 
  Upload, 
  Settings, 
  Play, 
  Pause, 
  Square, 
  Trash2, 
  Monitor, 
  Folder,
  Terminal,
  FileVideo,
  Clock,
  CheckCircle,
  AlertCircle,
  RotateCcw,
  Edit3,
  ChevronUp,
  ChevronDown,
  X,
  Save,
  FolderOpen,
  Plus,
  Image as ImageIcon,
  Eye
} from 'lucide-react';

interface BlenderFile {
  id: string;
  name: string;
  path: string;
  status: 'queued' | 'rendering' | 'paused' | 'completed' | 'error';
  progress: number;
  currentFrame?: number;
  lastRenderedFrame?: number;
  startFrame?: number;
  endFrame?: number;
  useCustomFrameRange: boolean;
  outputPath?: string;
  lastFrameImageUrl?: string;
}

interface RenderSettings {
  outputPath: string;
  outputFormat: 'PNG' | 'JPEG' | 'EXR' | 'TIFF' | 'MP4' | 'AVI';
  quality: number;
  samples: number;
  useFactorySettings: boolean;
  customFlags: string;
}

interface LogEntry {
  id: string;
  timestamp: Date;
  type: 'info' | 'command' | 'output' | 'error' | 'success';
  message: string;
  fileId?: string;
}

interface Project {
  id: string;
  name: string;
  description: string;
  files: BlenderFile[];
  settings: RenderSettings;
  logs: LogEntry[];
  createdAt: Date;
  lastModified: Date;
}

function App() {
  const [currentProject, setCurrentProject] = useState<Project | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [showProjectManager, setShowProjectManager] = useState(false);
  const [isRendering, setIsRendering] = useState(false);
  const [currentRenderingId, setCurrentRenderingId] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [editingFrameRange, setEditingFrameRange] = useState<string | null>(null);
  const [showTerminal, setShowTerminal] = useState(false);
  const [saveButtonPressed, setSaveButtonPressed] = useState(false);
  const [showFramePreview, setShowFramePreview] = useState(true);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const renderingRef = useRef(false);
  const terminalRef = useRef<HTMLDivElement>(null);

  // Load projects from localStorage on mount
  useEffect(() => {
    const savedProjects = localStorage.getItem('blender-render-projects');
    if (savedProjects) {
      try {
        const parsedProjects = JSON.parse(savedProjects).map((p: any) => ({
          ...p,
          createdAt: new Date(p.createdAt),
          lastModified: new Date(p.lastModified),
          logs: p.logs.map((log: any) => ({
            ...log,
            timestamp: new Date(log.timestamp)
          }))
        }));
        setProjects(parsedProjects);
        
        // Load the most recently modified project
        if (parsedProjects.length > 0) {
          const mostRecent = parsedProjects.reduce((latest: Project, current: Project) => 
            current.lastModified > latest.lastModified ? current : latest
          );
          setCurrentProject(mostRecent);
        }
      } catch (error) {
        console.error('Failed to load projects from localStorage:', error);
      }
    }
  }, []);

  // Save projects to localStorage whenever projects change
  useEffect(() => {
    if (projects.length > 0) {
      localStorage.setItem('blender-render-projects', JSON.stringify(projects));
    }
  }, [projects]);

  // Auto-scroll terminal to bottom when new logs are added
  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [currentProject?.logs]);

  const addLog = useCallback((type: LogEntry['type'], message: string, fileId?: string) => {
    if (!currentProject) return;
    
    const newLog: LogEntry = {
      id: crypto.randomUUID(),
      timestamp: new Date(),
      type,
      message,
      fileId
    };
    
    setCurrentProject(prev => {
      if (!prev) return prev;
      return { ...prev, logs: [...prev.logs, newLog] };
    });
  }, [currentProject]);

  const clearLogs = useCallback(() => {
    if (!currentProject) return;
    
    setCurrentProject(prev => {
      if (!prev) return prev;
      return { ...prev, logs: [] };
    });
  }, [currentProject]);

  const createNewProject = () => {
    const projectName = prompt('Enter project name:');
    if (!projectName) return;
    
    const projectDescription = prompt('Enter project description (optional):') || '';
    
    const newProject: Project = {
      id: crypto.randomUUID(),
      name: projectName,
      description: projectDescription,
      files: [],
      settings: {
        outputPath: '/tmp/renders/',
        outputFormat: 'PNG',
        quality: 90,
        samples: 128,
        useFactorySettings: false,
        customFlags: '--engine CYCLES'
      },
      logs: [],
      createdAt: new Date(),
      lastModified: new Date()
    };
    
    setProjects(prev => [...prev, newProject]);
    setCurrentProject(newProject);
    setShowProjectManager(false);
  };

  const loadProject = (project: Project) => {
    setCurrentProject(project);
    setShowProjectManager(false);
  };

  const deleteProject = (projectId: string) => {
    if (confirm('Are you sure you want to delete this project? This action cannot be undone.')) {
      setProjects(prev => prev.filter(p => p.id !== projectId));
      if (currentProject?.id === projectId) {
        setCurrentProject(null);
      }
    }
  };

  const saveCurrentProject = () => {
    if (!currentProject) return;
    
    // Trigger save animation
    setSaveButtonPressed(true);
    setTimeout(() => setSaveButtonPressed(false), 200);
    
    const updatedProject = {
      ...currentProject,
      lastModified: new Date()
    };
    
    setProjects(prev => prev.map(p => 
      p.id === currentProject.id ? updatedProject : p
    ));
    setCurrentProject(updatedProject);
    
    addLog('success', 'Project saved successfully');
  };

  const updateProjectFiles = (files: BlenderFile[]) => {
    if (!currentProject) return;
    
    setCurrentProject(prev => {
      if (!prev) return prev;
      return { ...prev, files };
    });
  };

  const updateProjectSettings = (settings: RenderSettings) => {
    if (!currentProject) return;
    
    setCurrentProject(prev => {
      if (!prev) return prev;
      return { ...prev, settings };
    });
  };

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (!currentProject) return;
    
    const droppedFiles = Array.from(e.dataTransfer.files);
    const blenderFiles = droppedFiles.filter(file => 
      file.name.endsWith('.blend')
    );
    
    const newFiles: BlenderFile[] = blenderFiles.map(file => ({
      id: crypto.randomUUID(),
      name: file.name,
      path: file.path || file.name,
      status: 'queued',
      progress: 0,
      useCustomFrameRange: false,
      startFrame: 1,
      endFrame: 250
    }));
    
    const updatedFiles = [...currentProject.files, ...newFiles];
    updateProjectFiles(updatedFiles);
    
    if (newFiles.length > 0) {
      addLog('info', `Added ${newFiles.length} .blend file(s) to queue`);
      newFiles.forEach(file => {
        addLog('info', `Queued: ${file.name}`, file.id);
      });
    }
  }, [currentProject, addLog]);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (!currentProject) return;
    
    const selectedFiles = Array.from(e.target.files || []);
    const blenderFiles = selectedFiles.filter(file => 
      file.name.endsWith('.blend')
    );
    
    const newFiles: BlenderFile[] = blenderFiles.map(file => ({
      id: crypto.randomUUID(),
      name: file.name,
      path: file.webkitRelativePath || file.name,
      status: 'queued',
      progress: 0,
      useCustomFrameRange: false,
      startFrame: 1,
      endFrame: 250
    }));
    
    const updatedFiles = [...currentProject.files, ...newFiles];
    updateProjectFiles(updatedFiles);
    
    if (newFiles.length > 0) {
      addLog('info', `Added ${newFiles.length} .blend file(s) to queue`);
      newFiles.forEach(file => {
        addLog('info', `Queued: ${file.name}`, file.id);
      });
    }
  }, [currentProject, addLog]);

  const updateFileFrameRange = (fileId: string, startFrame: number, endFrame: number, useCustom: boolean) => {
    if (!currentProject) return;
    
    const updatedFiles = currentProject.files.map(f => 
      f.id === fileId ? { 
        ...f, 
        startFrame, 
        endFrame, 
        useCustomFrameRange: useCustom 
      } : f
    );
    updateProjectFiles(updatedFiles);
    
    const file = currentProject.files.find(f => f.id === fileId);
    if (file) {
      if (useCustom) {
        addLog('info', `Updated frame range for ${file.name}: ${startFrame}-${endFrame}`, fileId);
      } else {
        addLog('info', `Using default frame range for ${file.name}`, fileId);
      }
    }
  };

  const generateCommandLine = (file: BlenderFile): string => {
    if (!currentProject) return '';
    
    const baseCmd = 'blender';
    const fileFlag = `-b "${file.path}"`;
    const outputFlag = `-o "${currentProject.settings.outputPath}${file.name.replace('.blend', '')}/${file.name.replace('.blend', '')}_####"`;
    const formatFlag = `-F ${currentProject.settings.outputFormat}`;
    
    let frameFlag = '';
    if (file.useCustomFrameRange && file.startFrame && file.endFrame) {
      frameFlag = `-s ${file.startFrame} -e ${file.endFrame}`;
    }
    
    const factoryFlag = currentProject.settings.useFactorySettings ? '--factory-startup' : '';
    const renderFlag = '-a';
    
    const parts = [baseCmd, fileFlag, outputFlag, formatFlag, frameFlag, factoryFlag, currentProject.settings.customFlags, renderFlag].filter(Boolean);
    return parts.join(' ');
  };

  // Generate mock frame preview URL
  const generateFramePreviewUrl = (file: BlenderFile, frame: number): string => {
    // In a real implementation, this would be the actual rendered frame path
    // For demo purposes, we'll use a placeholder image service
    const seed = `${file.id}-${frame}`;
    return `https://picsum.photos/seed/${seed}/400/300`;
  };

  const simulateRendering = async (fileId: string) => {
    if (!currentProject) return;
    
    const file = currentProject.files.find(f => f.id === fileId);
    if (!file) return;

    setCurrentRenderingId(fileId);
    
    // Determine frame range and starting point
    const startFrame = file.useCustomFrameRange && file.startFrame ? file.startFrame : 1;
    const endFrame = file.useCustomFrameRange && file.endFrame ? file.endFrame : 250;
    const resumeFromFrame = file.status === 'paused' && file.lastRenderedFrame 
      ? file.lastRenderedFrame + 1 
      : startFrame;
    
    // Log command execution
    const command = generateCommandLine(file);
    addLog('command', `Executing: ${command}`, fileId);
    addLog('info', `${file.status === 'paused' ? 'Resuming' : 'Starting'} render for ${file.name}`, fileId);
    
    if (file.status === 'paused') {
      addLog('info', `Resuming from frame ${resumeFromFrame}`, fileId);
    }
    
    addLog('output', `Blender 4.0.0 (hash 878f71061b8e built 2023-11-14 00:00:00)`, fileId);
    addLog('output', `Read blend file: ${file.path}`, fileId);
    addLog('output', `Scene: Scene`, fileId);
    addLog('output', `View Layer: ViewLayer`, fileId);
    
    // Update file status
    const updatedFiles = currentProject.files.map(f => 
      f.id === fileId ? { ...f, status: 'rendering' as const, currentFrame: resumeFromFrame } : f
    );
    updateProjectFiles(updatedFiles);

    // Simulate frame-by-frame rendering
    const totalFrames = endFrame - startFrame + 1;
    for (let frame = resumeFromFrame; frame <= endFrame; frame++) {
      if (!renderingRef.current) {
        // Paused by user - update file status to paused
        const pausedFiles = currentProject.files.map(f => 
          f.id === fileId ? { 
            ...f, 
            status: 'paused' as const, 
            lastRenderedFrame: frame - 1,
            currentFrame: undefined
          } : f
        );
        updateProjectFiles(pausedFiles);
        addLog('info', `Render paused at frame ${frame - 1} for ${file.name}`, fileId);
        break;
      }
      
      const progress = ((frame - startFrame + 1) / totalFrames) * 100;
      
      // Generate frame preview URL
      const frameImageUrl = generateFramePreviewUrl(file, frame);
      
      // Log frame rendering
      addLog('output', `Fra:${frame} Mem:${(Math.random() * 500 + 100).toFixed(1)}M (Peak ${(Math.random() * 800 + 200).toFixed(1)}M) | Time:${(Math.random() * 10 + 5).toFixed(2)}s | Remaining:${((totalFrames - (frame - startFrame + 1)) * (Math.random() * 10 + 5)).toFixed(0)}s`, fileId);
      
      const updatedFiles = currentProject.files.map(f => 
        f.id === fileId ? { 
          ...f, 
          progress, 
          currentFrame: frame,
          lastRenderedFrame: frame,
          lastFrameImageUrl: frameImageUrl,
          status: progress >= 100 ? 'completed' : 'rendering'
        } : f
      );
      updateProjectFiles(updatedFiles);
      
      // Simulate rendering time (faster for demo)
      await new Promise(resolve => setTimeout(resolve, 800));
    }
    
    if (renderingRef.current) {
      const completedFiles = currentProject.files.map(f => 
        f.id === fileId ? { ...f, status: 'completed' as const } : f
      );
      updateProjectFiles(completedFiles);
      addLog('success', `Render completed for ${file.name}`, fileId);
      addLog('output', `Saved: ${currentProject.settings.outputPath}${file.name.replace('.blend', '')}/`, fileId);
    }
  };

  const startRendering = async () => {
    if (!currentProject) return;
    
    setIsRendering(true);
    renderingRef.current = true;
    
    const renderableFiles = currentProject.files.filter(f => f.status === 'queued' || f.status === 'paused');
    const hasResumeFiles = renderableFiles.some(f => f.status === 'paused');
    
    addLog('info', `${hasResumeFiles ? 'Resuming' : 'Starting'} batch render for ${renderableFiles.length} file(s)`);
    
    for (const file of renderableFiles) {
      if (!renderingRef.current) break;
      await simulateRendering(file.id);
    }
    
    setCurrentRenderingId(null);
    setIsRendering(false);
    renderingRef.current = false;
    
    if (renderingRef.current !== false) {
      addLog('success', 'Batch render completed successfully');
    }
  };

  const pauseRendering = () => {
    renderingRef.current = false;
    addLog('info', 'Render process paused by user');
  };

  const stopRendering = () => {
    setIsRendering(false);
    renderingRef.current = false;
    setCurrentRenderingId(null);
    
    addLog('info', 'Render process stopped by user');
    
    // Reset currently rendering file to queued
    if (currentProject) {
      const updatedFiles = currentProject.files.map(f => 
        f.status === 'rendering' ? { ...f, status: 'queued', progress: 0, currentFrame: undefined, lastRenderedFrame: undefined } : f
      );
      updateProjectFiles(updatedFiles);
    }
  };

  const removeFile = (id: string) => {
    if (!currentProject) return;
    
    const file = currentProject.files.find(f => f.id === id);
    if (file) {
      addLog('info', `Removed ${file.name} from queue`, id);
    }
    const updatedFiles = currentProject.files.filter(f => f.id !== id);
    updateProjectFiles(updatedFiles);
  };

  const resetFile = (id: string) => {
    if (!currentProject) return;
    
    const file = currentProject.files.find(f => f.id === id);
    if (file) {
      addLog('info', `Reset ${file.name} to queued status`, id);
    }
    const updatedFiles = currentProject.files.map(f => 
      f.id === id ? { ...f, status: 'queued', progress: 0, currentFrame: undefined, lastRenderedFrame: undefined, lastFrameImageUrl: undefined } : f
    );
    updateProjectFiles(updatedFiles);
  };

  const clearCompleted = () => {
    if (!currentProject) return;
    
    const completedCount = currentProject.files.filter(f => f.status === 'completed').length;
    addLog('info', `Cleared ${completedCount} completed file(s)`);
    const updatedFiles = currentProject.files.filter(f => f.status !== 'completed');
    updateProjectFiles(updatedFiles);
  };

  const getStatusIcon = (status: BlenderFile['status']) => {
    switch (status) {
      case 'queued': return <Clock className="w-4 h-4 text-gray-500" />;
      case 'rendering': return <Monitor className="w-4 h-4 text-blue-500 animate-pulse" />;
      case 'paused': return <Pause className="w-4 h-4 text-orange-500" />;
      case 'completed': return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'error': return <AlertCircle className="w-4 h-4 text-red-500" />;
    }
  };

  const getLogTypeColor = (type: LogEntry['type']) => {
    switch (type) {
      case 'info': return 'text-blue-400';
      case 'command': return 'text-purple-400';
      case 'output': return 'text-gray-300';
      case 'error': return 'text-red-400';
      case 'success': return 'text-green-400';
      default: return 'text-gray-300';
    }
  };

  const getLogTypePrefix = (type: LogEntry['type']) => {
    switch (type) {
      case 'info': return '[INFO]';
      case 'command': return '[CMD]';
      case 'output': return '[OUT]';
      case 'error': return '[ERR]';
      case 'success': return '[OK]';
      default: return '[LOG]';
    }
  };

  if (!currentProject) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 text-white flex items-center justify-center">
        <div className="text-center space-y-8">
          <div className="w-24 h-24 bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl flex items-center justify-center mx-auto">
            <FileVideo className="w-12 h-12" />
          </div>
          
          <div>
            <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent mb-4">
              Blender Batch Render Farm
            </h1>
            <p className="text-gray-400 text-lg mb-8">
              Professional rendering pipeline management with project organization
            </p>
          </div>
          
          <div className="flex items-center justify-center space-x-4">
            <button
              onClick={createNewProject}
              className="flex items-center space-x-2 px-6 py-3 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 rounded-lg transition-all transform hover:scale-105"
            >
              <Plus className="w-5 h-5" />
              <span>Create New Project</span>
            </button>
            
            {projects.length > 0 && (
              <button
                onClick={() => setShowProjectManager(true)}
                className="flex items-center space-x-2 px-6 py-3 bg-gray-700 hover:bg-gray-600 rounded-lg transition-all transform hover:scale-105"
              >
                <FolderOpen className="w-5 h-5" />
                <span>Load Project</span>
              </button>
            )}
          </div>
        </div>
        
        {/* Project Manager Modal */}
        {showProjectManager && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
            <div className="bg-gray-800 rounded-xl p-6 max-w-4xl w-full mx-4 max-h-[80vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold">Load Project</h2>
                <button
                  onClick={() => setShowProjectManager(false)}
                  className="p-2 text-gray-400 hover:text-white transition-colors"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {projects.map((project) => (
                  <div key={project.id} className="bg-gray-700 rounded-lg p-4 hover:bg-gray-600 transition-colors">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <h3 className="font-semibold text-white">{project.name}</h3>
                        {project.description && (
                          <p className="text-sm text-gray-400 mt-1">{project.description}</p>
                        )}
                      </div>
                      <button
                        onClick={() => deleteProject(project.id)}
                        className="p-1 text-red-400 hover:text-red-300 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                    
                    <div className="space-y-2 mb-4">
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-400">Files:</span>
                        <span className="text-white">{project.files.length}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-400">Created:</span>
                        <span className="text-white">{project.createdAt.toLocaleDateString()}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-400">Modified:</span>
                        <span className="text-white">{project.lastModified.toLocaleDateString()}</span>
                      </div>
                    </div>
                    
                    <button
                      onClick={() => loadProject(project)}
                      className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
                    >
                      Load Project
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  const totalFiles = currentProject.files.length;
  const completedFiles = currentProject.files.filter(f => f.status === 'completed').length;
  const queuedFiles = currentProject.files.filter(f => f.status === 'queued').length;
  const renderingFiles = currentProject.files.filter(f => f.status === 'rendering').length;
  const pausedFiles = currentProject.files.filter(f => f.status === 'paused').length;
  const hasResumableFiles = pausedFiles > 0;

  const currentRenderingFile = currentRenderingId ? currentProject.files.find(f => f.id === currentRenderingId) : null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 text-white flex flex-col">
      {/* Header */}
      <div className="border-b border-gray-700 bg-gray-800/50 backdrop-blur-sm">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
                <FileVideo className="w-6 h-6" />
              </div>
              <div>
                <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
                  {currentProject.name}
                </h1>
                <p className="text-sm text-gray-400">{currentProject.description || 'Professional rendering pipeline management'}</p>
              </div>
            </div>
            
            <div className="flex items-center space-x-3">
              <button
                onClick={() => setShowProjectManager(true)}
                className="flex items-center space-x-2 px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors"
              >
                <FolderOpen className="w-4 h-4" />
                <span>Projects</span>
              </button>
              
              <button
                onClick={saveCurrentProject}
                className={`flex items-center space-x-2 px-4 py-2 rounded-lg transition-all transform ${
                  saveButtonPressed 
                    ? 'bg-green-600 scale-95 shadow-inner' 
                    : 'bg-gray-700 hover:bg-gray-600 hover:scale-105 shadow-lg'
                }`}
              >
                <Save className={`w-4 h-4 transition-transform ${saveButtonPressed ? 'scale-110' : ''}`} />
                <span>Save</span>
              </button>
              
              <button
                onClick={() => setShowTerminal(!showTerminal)}
                className={`flex items-center space-x-2 px-4 py-2 rounded-lg transition-colors ${
                  showTerminal 
                    ? 'bg-green-600 hover:bg-green-700' 
                    : 'bg-gray-700 hover:bg-gray-600'
                }`}
              >
                <Terminal className="w-4 h-4" />
                <span>Terminal</span>
              </button>
              
              <button
                onClick={() => setShowSettings(!showSettings)}
                className="flex items-center space-x-2 px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors"
              >
                <Settings className="w-4 h-4" />
                <span>Settings</span>
              </button>
              
              <div className="flex items-center space-x-2">
                {!isRendering ? (
                  <button
                    onClick={startRendering}
                    disabled={queuedFiles === 0 && pausedFiles === 0}
                    className="flex items-center space-x-2 px-6 py-2 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 disabled:from-gray-600 disabled:to-gray-700 rounded-lg transition-all disabled:opacity-50"
                  >
                    <Play className="w-4 h-4" />
                    <span>{hasResumableFiles ? 'Resume Render' : 'Start Render'}</span>
                  </button>
                ) : (
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={pauseRendering}
                      className="flex items-center space-x-2 px-4 py-2 bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 rounded-lg transition-all"
                    >
                      <Pause className="w-4 h-4" />
                      <span>Pause</span>
                    </button>
                    <button
                      onClick={stopRendering}
                      className="flex items-center space-x-2 px-4 py-2 bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 rounded-lg transition-all"
                    >
                      <Square className="w-4 h-4" />
                      <span>Stop</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 flex flex-col">
        {/* Terminal */}
        {showTerminal && (
          <div className="border-b border-gray-700 bg-gray-900/90 backdrop-blur-sm">
            <div className="container mx-auto px-6">
              <div className="flex items-center justify-between py-2 border-b border-gray-700">
                <div className="flex items-center space-x-2">
                  <Terminal className="w-4 h-4 text-green-400" />
                  <span className="text-sm font-medium text-green-400">Terminal Output</span>
                  <span className="text-xs text-gray-400">({currentProject.logs.length} entries)</span>
                </div>
                <div className="flex items-center space-x-2">
                  <button
                    onClick={clearLogs}
                    className="text-xs px-2 py-1 bg-gray-700 hover:bg-gray-600 rounded transition-colors"
                  >
                    Clear
                  </button>
                  <button
                    onClick={() => setShowTerminal(false)}
                    className="p-1 text-gray-400 hover:text-white transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
              
              <div 
                ref={terminalRef}
                className="h-64 overflow-y-auto font-mono text-xs p-4 space-y-1"
              >
                {currentProject.logs.length === 0 ? (
                  <div className="text-gray-500 italic">No logs yet. Start rendering to see output...</div>
                ) : (
                  currentProject.logs.map((log) => (
                    <div key={log.id} className="flex items-start space-x-2">
                      <span className="text-gray-500 shrink-0">
                        {log.timestamp.toLocaleTimeString()}
                      </span>
                      <span className={`shrink-0 ${getLogTypeColor(log.type)}`}>
                        {getLogTypePrefix(log.type)}
                      </span>
                      <span className={`${getLogTypeColor(log.type)} break-all`}>
                        {log.message}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        <div className="flex-1 container mx-auto px-6 py-6">
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            {/* Main Content */}
            <div className="lg:col-span-3 space-y-6">
              {/* Stats */}
              <div className="grid grid-cols-5 gap-4">
                <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl p-4 border border-gray-700">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-400">Total Files</p>
                      <p className="text-2xl font-bold text-white">{totalFiles}</p>
                    </div>
                    <div className="w-10 h-10 bg-blue-500/20 rounded-lg flex items-center justify-center">
                      <FileVideo className="w-5 h-5 text-blue-400" />
                    </div>
                  </div>
                </div>
                
                <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl p-4 border border-gray-700">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-400">Queued</p>
                      <p className="text-2xl font-bold text-yellow-400">{queuedFiles}</p>
                    </div>
                    <div className="w-10 h-10 bg-yellow-500/20 rounded-lg flex items-center justify-center">
                      <Clock className="w-5 h-5 text-yellow-400" />
                    </div>
                  </div>
                </div>
                
                <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl p-4 border border-gray-700">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-400">Rendering</p>
                      <p className="text-2xl font-bold text-blue-400">{renderingFiles}</p>
                    </div>
                    <div className="w-10 h-10 bg-blue-500/20 rounded-lg flex items-center justify-center">
                      <Monitor className="w-5 h-5 text-blue-400" />
                    </div>
                  </div>
                </div>
                
                <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl p-4 border border-gray-700">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-400">Paused</p>
                      <p className="text-2xl font-bold text-orange-400">{pausedFiles}</p>
                    </div>
                    <div className="w-10 h-10 bg-orange-500/20 rounded-lg flex items-center justify-center">
                      <Pause className="w-5 h-5 text-orange-400" />
                    </div>
                  </div>
                </div>
                
                <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl p-4 border border-gray-700">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-400">Completed</p>
                      <p className="text-2xl font-bold text-green-400">{completedFiles}</p>
                    </div>
                    <div className="w-10 h-10 bg-green-500/20 rounded-lg flex items-center justify-center">
                      <CheckCircle className="w-5 h-5 text-green-400" />
                    </div>
                  </div>
                </div>
              </div>

              {/* File Drop Zone */}
              {currentProject.files.length === 0 && (
                <div
                  onDragOver={handleDragOver}
                  onDrop={handleDrop}
                  className="border-2 border-dashed border-gray-600 rounded-xl p-12 text-center bg-gray-800/30 hover:bg-gray-800/50 transition-colors cursor-pointer"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <div className="space-y-4">
                    <div className="w-16 h-16 bg-gradient-to-br from-blue-500/20 to-purple-600/20 rounded-full flex items-center justify-center mx-auto">
                      <Upload className="w-8 h-8 text-blue-400" />
                    </div>
                    <div>
                      <h3 className="text-xl font-semibold text-white mb-2">Drop Blender Files Here</h3>
                      <p className="text-gray-400">
                        Drag and drop your .blend files or click to browse
                      </p>
                      <p className="text-sm text-gray-500 mt-2">
                        Supported format: .blend files only
                      </p>
                    </div>
                  </div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    accept=".blend"
                    onChange={handleFileSelect}
                    className="hidden"
                  />
                </div>
              )}

              {/* File List */}
              {currentProject.files.length > 0 && (
                <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl border border-gray-700">
                  <div className="p-4 border-b border-gray-700 flex items-center justify-between">
                    <h3 className="text-lg font-semibold">Render Queue</h3>
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => fileInputRef.current?.click()}
                        className="flex items-center space-x-2 px-3 py-1 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors text-sm"
                      >
                        <Upload className="w-4 h-4" />
                        <span>Add Files</span>
                      </button>
                      {completedFiles > 0 && (
                        <button
                          onClick={clearCompleted}
                          className="flex items-center space-x-2 px-3 py-1 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors text-sm"
                        >
                          <CheckCircle className="w-4 h-4" />
                          <span>Clear Completed</span>
                        </button>
                      )}
                    </div>
                    <input
                      ref={fileInputRef}
                      type="file"
                      multiple
                      accept=".blend"
                      onChange={handleFileSelect}
                      className="hidden"
                    />
                  </div>
                  
                  <div className="divide-y divide-gray-700">
                    {currentProject.files.map((file) => (
                      <div key={file.id} className="p-4">
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center space-x-3">
                            {getStatusIcon(file.status)}
                            <div>
                              <h4 className="font-medium text-white">{file.name}</h4>
                              <p className="text-sm text-gray-400">{file.path}</p>
                              {file.status === 'paused' && file.lastRenderedFrame && (
                                <p className="text-sm text-orange-400">
                                  Paused at frame {file.lastRenderedFrame}
                                </p>
                              )}
                            </div>
                          </div>
                          
                          <div className="flex items-center space-x-2">
                            {file.status === 'rendering' && file.currentFrame && (
                              <span className="text-sm text-blue-400 font-mono">
                                Frame {file.currentFrame}
                              </span>
                            )}
                            
                            {file.status !== 'rendering' && (
                              <button
                                onClick={() => setEditingFrameRange(editingFrameRange === file.id ? null : file.id)}
                                className="p-1 text-gray-400 hover:text-white transition-colors"
                                title="Edit Frame Range"
                              >
                                <Edit3 className="w-4 h-4" />
                              </button>
                            )}
                            
                            {(file.status === 'completed' || file.status === 'error' || file.status === 'paused') && (
                              <button
                                onClick={() => resetFile(file.id)}
                                className="p-1 text-gray-400 hover:text-white transition-colors"
                                title="Reset"
                              >
                                <RotateCcw className="w-4 h-4" />
                              </button>
                            )}
                            
                            <button
                              onClick={() => removeFile(file.id)}
                              className="p-1 text-red-400 hover:text-red-300 transition-colors"
                              title="Remove"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>

                        {/* Frame Range Editor */}
                        {editingFrameRange === file.id && (
                          <div className="mb-3 p-3 bg-gray-700/50 rounded-lg border border-gray-600">
                            <div className="flex items-center space-x-4">
                              <label className="flex items-center space-x-2">
                                <input
                                  type="checkbox"
                                  checked={file.useCustomFrameRange}
                                  onChange={(e) => updateFileFrameRange(
                                    file.id, 
                                    file.startFrame || 1, 
                                    file.endFrame || 250, 
                                    e.target.checked
                                  )}
                                  className="rounded bg-gray-600 border-gray-500 text-blue-500 focus:ring-blue-500"
                                />
                                <span className="text-sm text-gray-300">Use custom frame range</span>
                              </label>
                              
                              {file.useCustomFrameRange && (
                                <>
                                  <div className="flex items-center space-x-2">
                                    <label className="text-sm text-gray-300">Start:</label>
                                    <input
                                      type="number"
                                      value={file.startFrame || 1}
                                      onChange={(e) => updateFileFrameRange(
                                        file.id, 
                                        parseInt(e.target.value) || 1, 
                                        file.endFrame || 250, 
                                        file.useCustomFrameRange
                                      )}
                                      className="w-20 bg-gray-600 border border-gray-500 rounded px-2 py-1 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    />
                                  </div>
                                  
                                  <div className="flex items-center space-x-2">
                                    <label className="text-sm text-gray-300">End:</label>
                                    <input
                                      type="number"
                                      value={file.endFrame || 250}
                                      onChange={(e) => updateFileFrameRange(
                                        file.id, 
                                        file.startFrame || 1, 
                                        parseInt(e.target.value) || 250, 
                                        file.useCustomFrameRange
                                      )}
                                      className="w-20 bg-gray-600 border border-gray-500 rounded px-2 py-1 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    />
                                  </div>
                                </>
                              )}
                            </div>
                            
                            {!file.useCustomFrameRange && (
                              <p className="text-xs text-gray-400 mt-2">
                                Will use frame range from the .blend file
                              </p>
                            )}
                          </div>
                        )}
                        
                        {/* Progress Bar */}
                        <div className="w-full bg-gray-700 rounded-full h-2">
                          <div
                            className={`h-2 rounded-full transition-all duration-300 ${
                              file.status === 'completed' ? 'bg-green-500' :
                              file.status === 'rendering' ? 'bg-blue-500' :
                              file.status === 'paused' ? 'bg-orange-500' :
                              file.status === 'error' ? 'bg-red-500' :
                              'bg-gray-600'
                            }`}
                            style={{ width: `${file.progress}%` }}
                          />
                        </div>
                        
                        <div className="mt-2 flex justify-between items-center">
                          <div className="text-xs text-gray-400">
                            Progress: {file.progress.toFixed(1)}%
                          </div>
                          {file.useCustomFrameRange && file.startFrame && file.endFrame && (
                            <div className="text-xs text-gray-400">
                              Frames: {file.startFrame}-{file.endFrame}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Sidebar */}
            <div className="space-y-6">
              {/* Frame Preview */}
              {currentRenderingFile && currentRenderingFile.lastFrameImageUrl && showFramePreview && (
                <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl p-4 border border-gray-700">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold flex items-center space-x-2">
                      <ImageIcon className="w-5 h-5" />
                      <span>Last Rendered Frame</span>
                    </h3>
                    <button
                      onClick={() => setShowFramePreview(!showFramePreview)}
                      className="p-1 text-gray-400 hover:text-white transition-colors"
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                  </div>
                  
                  <div className="space-y-3">
                    <div className="aspect-video bg-gray-900 rounded-lg overflow-hidden border border-gray-600">
                      <img
                        src={currentRenderingFile.lastFrameImageUrl}
                        alt={`Frame ${currentRenderingFile.currentFrame || currentRenderingFile.lastRenderedFrame}`}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          // Fallback to a placeholder if image fails to load
                          e.currentTarget.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAwIiBoZWlnaHQ9IjMwMCIgdmlld0JveD0iMCAwIDQwMCAzMDAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSI0MDAiIGhlaWdodD0iMzAwIiBmaWxsPSIjMzc0MTUxIi8+CjxwYXRoIGQ9Ik0yMDAgMTUwTDE3NSAxMjVIMTUwVjE3NUgxNzVMMjAwIDE1MFoiIGZpbGw9IiM2QjcyODAiLz4KPHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHZpZXdCb3g9IjAgMCA0MCA0MCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIiB4PSIxODAiIHk9IjEzMCI+CjxjaXJjbGUgY3g9IjIwIiBjeT0iMjAiIHI9IjE1IiBzdHJva2U9IiM2QjcyODAiIHN0cm9rZS13aWR0aD0iMiIvPgo8L3N2Zz4KPC9zdmc+';
                        }}
                      />
                    </div>
                    
                    <div className="text-center">
                      <div className="text-sm font-medium text-white">
                        {currentRenderingFile.name}
                      </div>
                      <div className="text-xs text-gray-400">
                        Frame {currentRenderingFile.currentFrame || currentRenderingFile.lastRenderedFrame}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Settings Panel */}
              {showSettings && (
                <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl p-4 border border-gray-700">
                  <h3 className="text-lg font-semibold mb-4 flex items-center space-x-2">
                    <Settings className="w-5 h-5" />
                    <span>Render Settings</span>
                  </h3>
                  
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">
                        Output Path
                      </label>
                      <div className="flex items-center space-x-2">
                        <input
                          type="text"
                          value={currentProject.settings.outputPath}
                          onChange={(e) => updateProjectSettings({ ...currentProject.settings, outputPath: e.target.value })}
                          className="flex-1 bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                        <button className="p-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors">
                          <Folder className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">
                        Output Format
                      </label>
                      <select
                        value={currentProject.settings.outputFormat}
                        onChange={(e) => updateProjectSettings({ ...currentProject.settings, outputFormat: e.target.value as RenderSettings['outputFormat'] })}
                        className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="PNG">PNG</option>
                        <option value="JPEG">JPEG</option>
                        <option value="EXR">EXR</option>
                        <option value="TIFF">TIFF</option>
                        <option value="MP4">MP4</option>
                        <option value="AVI">AVI</option>
                      </select>
                    </div>
                    
                    <div>
                      <label className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          checked={currentProject.settings.useFactorySettings}
                          onChange={(e) => updateProjectSettings({ ...currentProject.settings, useFactorySettings: e.target.checked })}
                          className="rounded bg-gray-700 border-gray-600 text-blue-500 focus:ring-blue-500"
                        />
                        <span className="text-sm font-medium text-gray-300">Use Factory Settings</span>
                      </label>
                      <p className="text-xs text-gray-400 mt-1 ml-6">
                        Starts Blender with default settings, ignoring user preferences
                      </p>
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">
                        Samples
                      </label>
                      <input
                        type="number"
                        value={currentProject.settings.samples}
                        onChange={(e) => updateProjectSettings({ ...currentProject.settings, samples: parseInt(e.target.value) })}
                        className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">
                        Custom Flags
                      </label>
                      <input
                        type="text"
                        value={currentProject.settings.customFlags}
                        onChange={(e) => updateProjectSettings({ ...currentProject.settings, customFlags: e.target.value })}
                        placeholder="--engine CYCLES --gpu-type OPTIX"
                        className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Command Preview */}
              {currentProject.files.length > 0 && (
                <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl p-4 border border-gray-700">
                  <h3 className="text-lg font-semibold mb-4 flex items-center space-x-2">
                    <Terminal className="w-5 h-5" />
                    <span>Command Preview</span>
                  </h3>
                  
                  <div className="bg-gray-900 rounded-lg p-3 font-mono text-xs overflow-x-auto">
                    <div className="text-gray-400 mb-2"># First file command:</div>
                    <div className="text-green-400 break-all">
                      {generateCommandLine(currentProject.files[0])}
                    </div>
                  </div>
                </div>
              )}

              {/* Current Rendering */}
              {currentRenderingId && (
                <div className="bg-gradient-to-br from-blue-500/20 to-purple-600/20 rounded-xl p-4 border border-blue-500/30">
                  <h3 className="text-lg font-semibold mb-4 flex items-center space-x-2">
                    <Monitor className="w-5 h-5 animate-pulse" />
                    <span>Currently Rendering</span>
                  </h3>
                  
                  {currentRenderingFile && (
                    <div className="space-y-3">
                      <div>
                        <div className="font-medium text-white">{currentRenderingFile.name}</div>
                        <div className="text-sm text-gray-300 font-mono">
                          Rendering Frame {currentRenderingFile.currentFrame}
                        </div>
                      </div>
                      
                      <div className="w-full bg-gray-700 rounded-full h-3">
                        <div
                          className="h-3 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full transition-all duration-300"
                          style={{ width: `${currentRenderingFile.progress}%` }}
                        />
                      </div>
                      
                      <div className="text-sm text-gray-300">
                        {currentRenderingFile.progress.toFixed(1)}% Complete
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Project Manager Modal */}
      {showProjectManager && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-xl p-6 max-w-4xl w-full mx-4 max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold">Project Manager</h2>
              <div className="flex items-center space-x-2">
                <button
                  onClick={createNewProject}
                  className="flex items-center space-x-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  <span>New Project</span>
                </button>
                <button
                  onClick={() => setShowProjectManager(false)}
                  className="p-2 text-gray-400 hover:text-white transition-colors"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {projects.map((project) => (
                <div key={project.id} className={`bg-gray-700 rounded-lg p-4 hover:bg-gray-600 transition-colors ${currentProject?.id === project.id ? 'ring-2 ring-blue-500' : ''}`}>
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <h3 className="font-semibold text-white">{project.name}</h3>
                      {project.description && (
                        <p className="text-sm text-gray-400 mt-1">{project.description}</p>
                      )}
                    </div>
                    <button
                      onClick={() => deleteProject(project.id)}
                      className="p-1 text-red-400 hover:text-red-300 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                  
                  <div className="space-y-2 mb-4">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-400">Files:</span>
                      <span className="text-white">{project.files.length}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-400">Created:</span>
                      <span className="text-white">{project.createdAt.toLocaleDateString()}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-400">Modified:</span>
                      <span className="text-white">{project.lastModified.toLocaleDateString()}</span>
                    </div>
                  </div>
                  
                  <button
                    onClick={() => loadProject(project)}
                    className={`w-full px-4 py-2 rounded-lg transition-colors ${
                      currentProject?.id === project.id 
                        ? 'bg-blue-700 text-white cursor-default' 
                        : 'bg-blue-600 hover:bg-blue-700'
                    }`}
                    disabled={currentProject?.id === project.id}
                  >
                    {currentProject?.id === project.id ? 'Current Project' : 'Load Project'}
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;