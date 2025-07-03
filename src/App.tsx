import React, { useState, useEffect } from 'react';
import { Monitor, Settings, Play, AlertCircle, CheckCircle } from 'lucide-react';
import { useElectron } from './hooks/useElectron';
import { BlendFileSelector } from './components/BlendFileSelector';
import { RenderSettings } from './components/RenderSettings';
import { RenderQueue } from './components/RenderQueue';

interface BlendFile {
  path: string;
  name: string;
}

function App() {
  const { isElectron, electronAPI } = useElectron();
  const [selectedFiles, setSelectedFiles] = useState<BlendFile[]>([]);
  const [outputPath, setOutputPath] = useState('');
  const [startFrame, setStartFrame] = useState(1);
  const [endFrame, setEndFrame] = useState(250);
  const [blenderStatus, setBlenderStatus] = useState<'checking' | 'found' | 'not-found'>('checking');

  useEffect(() => {
    if (electronAPI) {
      // Check Blender installation
      electronAPI.checkBlender().then(blenderPath => {
        setBlenderStatus(blenderPath ? 'found' : 'not-found');
      });
    }
  }, [electronAPI]);

  const handleCreateRenderJobs = async () => {
    if (!electronAPI || selectedFiles.length === 0 || !outputPath) return;

    for (const file of selectedFiles) {
      const outputFileName = `${file.name.replace('.blend', '')}_####.png`;
      const fullOutputPath = `${outputPath}/${outputFileName}`;
      
      await electronAPI.createRenderJob({
        blendFile: file.path,
        outputPath: fullOutputPath,
        startFrame,
        endFrame
      });
    }

    // Clear selected files after creating jobs
    setSelectedFiles([]);
  };

  const canCreateJobs = selectedFiles.length > 0 && outputPath && blenderStatus === 'found';

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Monitor className="w-8 h-8 text-blue-600" />
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Blender Batch Render Farm</h1>
              <p className="text-sm text-gray-500">
                {isElectron ? 'Desktop Application' : 'Web Application'}
              </p>
            </div>
          </div>
          
          <div className="flex items-center space-x-4">
            {/* Blender Status */}
            <div className="flex items-center space-x-2">
              {blenderStatus === 'checking' && (
                <>
                  <div className="w-2 h-2 bg-yellow-500 rounded-full animate-pulse" />
                  <span className="text-sm text-gray-600">Checking Blender...</span>
                </>
              )}
              {blenderStatus === 'found' && (
                <>
                  <CheckCircle className="w-5 h-5 text-green-500" />
                  <span className="text-sm text-green-600">Blender Ready</span>
                </>
              )}
              {blenderStatus === 'not-found' && (
                <>
                  <AlertCircle className="w-5 h-5 text-red-500" />
                  <span className="text-sm text-red-600">Blender Not Found</span>
                </>
              )}
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-6 py-8">
        {!isElectron && (
          <div className="mb-8 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
            <div className="flex items-center space-x-2">
              <AlertCircle className="w-5 h-5 text-yellow-600" />
              <p className="text-yellow-800">
                This application works best as a desktop app. Download the Electron version for full functionality.
              </p>
            </div>
          </div>
        )}

        {blenderStatus === 'not-found' && (
          <div className="mb-8 p-4 bg-red-50 border border-red-200 rounded-lg">
            <div className="flex items-center space-x-2">
              <AlertCircle className="w-5 h-5 text-red-600" />
              <div>
                <p className="text-red-800 font-medium">Blender Not Found</p>
                <p className="text-red-700 text-sm mt-1">
                  Please install Blender and ensure it's available in your system PATH, or install it in a standard location.
                </p>
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
          {/* Left Column - File Selection and Settings */}
          <div className="xl:col-span-2 space-y-8">
            {/* Blend File Selection */}
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <BlendFileSelector
                selectedFiles={selectedFiles}
                onFilesChange={setSelectedFiles}
              />
            </div>

            {/* Render Settings */}
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <RenderSettings
                outputPath={outputPath}
                onOutputPathChange={setOutputPath}
                startFrame={startFrame}
                onStartFrameChange={setStartFrame}
                endFrame={endFrame}
                onEndFrameChange={setEndFrame}
              />
            </div>

            {/* Create Jobs Button */}
            <div className="flex justify-center">
              <button
                onClick={handleCreateRenderJobs}
                disabled={!canCreateJobs}
                className="inline-flex items-center px-8 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-lg font-medium"
              >
                <Play className="w-5 h-5 mr-2" />
                Create Render Jobs
              </button>
            </div>
          </div>

          {/* Right Column - Render Queue */}
          <div className="xl:col-span-1">
            <div className="bg-white rounded-lg border border-gray-200 p-6 sticky top-8">
              <RenderQueue />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;