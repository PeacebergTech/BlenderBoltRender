import React, { useState } from 'react';
import { Settings, FolderOpen, CheckCircle, XCircle, RefreshCw } from 'lucide-react';
import { useBlenderService } from '../hooks/useBlenderService';
import { useElectron } from '../hooks/useElectron';

export const BlenderPathSettings: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [customPath, setCustomPath] = useState('');
  const { 
    isBlenderAvailable, 
    blenderVersion, 
    blenderPath, 
    isChecking, 
    checkBlenderAvailability, 
    updateBlenderPath 
  } = useBlenderService();
  const { electronAPI } = useElectron();

  const handleBrowseBlender = async () => {
    if (!electronAPI) return;

    const result = await electronAPI.showOpenDialog({
      properties: ['openFile'],
      filters: [
        { name: 'Blender Executable', extensions: ['exe', 'app', ''] },
        { name: 'All Files', extensions: ['*'] }
      ]
    });

    if (!result.canceled && result.filePaths.length > 0) {
      const selectedPath = result.filePaths[0];
      setCustomPath(selectedPath);
      await updateBlenderPath(selectedPath);
    }
  };

  const handleSetCustomPath = async () => {
    if (customPath.trim()) {
      await updateBlenderPath(customPath.trim());
    }
  };

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="flex items-center gap-2 px-3 py-2 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
      >
        <Settings className="w-4 h-4" />
        Blender Settings
      </button>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">Blender Configuration</h3>
          <button
            onClick={() => setIsOpen(false)}
            className="text-gray-400 hover:text-gray-600"
          >
            ×
          </button>
        </div>

        <div className="space-y-4">
          {/* Status */}
          <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
            {isChecking ? (
              <RefreshCw className="w-5 h-5 text-blue-500 animate-spin" />
            ) : isBlenderAvailable ? (
              <CheckCircle className="w-5 h-5 text-green-500" />
            ) : (
              <XCircle className="w-5 h-5 text-red-500" />
            )}
            <div>
              <div className="font-medium">
                {isChecking ? 'Checking...' : isBlenderAvailable ? 'Blender Available' : 'Blender Not Found'}
              </div>
              {blenderVersion && (
                <div className="text-sm text-gray-600">Version: {blenderVersion}</div>
              )}
            </div>
          </div>

          {/* Current Path */}
          {blenderPath && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Current Path
              </label>
              <div className="p-2 bg-gray-100 rounded text-sm font-mono break-all">
                {blenderPath}
              </div>
            </div>
          )}

          {/* Custom Path Input */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Custom Blender Path
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={customPath}
                onChange={(e) => setCustomPath(e.target.value)}
                placeholder="Enter path to Blender executable..."
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <button
                onClick={handleBrowseBlender}
                className="px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                title="Browse for Blender"
              >
                <FolderOpen className="w-4 h-4" />
              </button>
            </div>
            {customPath && (
              <button
                onClick={handleSetCustomPath}
                className="mt-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
              >
                Set Path
              </button>
            )}
          </div>

          {/* Actions */}
          <div className="flex gap-2 pt-2">
            <button
              onClick={checkBlenderAvailability}
              disabled={isChecking}
              className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 transition-colors"
            >
              <RefreshCw className={`w-4 h-4 ${isChecking ? 'animate-spin' : ''}`} />
              Refresh
            </button>
            <button
              onClick={() => setIsOpen(false)}
              className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 transition-colors"
            >
              Close
            </button>
          </div>

          {/* Help Text */}
          {!isBlenderAvailable && (
            <div className="text-sm text-gray-600 bg-yellow-50 p-3 rounded-lg">
              <strong>Blender not found.</strong> Please install Blender or set the correct path above.
              <br />
              <br />
              Common locations:
              <ul className="mt-1 ml-4 list-disc">
                <li>Windows: C:\Program Files\Blender Foundation\Blender X.X\blender.exe</li>
                <li>macOS: /Applications/Blender.app/Contents/MacOS/Blender</li>
                <li>Linux: /usr/bin/blender</li>
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};