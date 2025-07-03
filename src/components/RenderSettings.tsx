import React, { useState } from 'react';
import { Settings, FolderOpen } from 'lucide-react';
import { useElectron } from '../hooks/useElectron';

interface RenderSettingsProps {
  outputPath: string;
  onOutputPathChange: (path: string) => void;
  startFrame: number;
  onStartFrameChange: (frame: number) => void;
  endFrame: number;
  onEndFrameChange: (frame: number) => void;
}

export function RenderSettings({
  outputPath,
  onOutputPathChange,
  startFrame,
  onStartFrameChange,
  endFrame,
  onEndFrameChange
}: RenderSettingsProps) {
  const { electronAPI } = useElectron();

  const handleSelectOutputPath = async () => {
    if (electronAPI) {
      const selectedPath = await electronAPI.selectOutputDirectory();
      if (selectedPath) {
        onOutputPathChange(selectedPath);
      }
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center space-x-2">
        <Settings className="w-5 h-5 text-gray-600" />
        <h3 className="text-lg font-semibold text-gray-900">Render Settings</h3>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Start Frame
            </label>
            <input
              type="number"
              value={startFrame}
              onChange={(e) => onStartFrameChange(parseInt(e.target.value) || 1)}
              min="1"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              End Frame
            </label>
            <input
              type="number"
              value={endFrame}
              onChange={(e) => onEndFrameChange(parseInt(e.target.value) || 250)}
              min="1"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Output Directory
          </label>
          <div className="flex space-x-2">
            <input
              type="text"
              value={outputPath}
              onChange={(e) => onOutputPathChange(e.target.value)}
              placeholder="Select output directory..."
              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <button
              onClick={handleSelectOutputPath}
              className="px-3 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
            >
              <FolderOpen className="w-5 h-5" />
            </button>
          </div>
          {outputPath && (
            <p className="mt-1 text-sm text-gray-500 truncate" title={outputPath}>
              {outputPath}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}