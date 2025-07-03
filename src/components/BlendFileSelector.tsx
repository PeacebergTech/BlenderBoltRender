import React, { useState } from 'react';
import { Plus, FileText, X } from 'lucide-react';
import { useElectron } from '../hooks/useElectron';

interface BlendFile {
  path: string;
  name: string;
}

interface BlendFileSelectorProps {
  selectedFiles: BlendFile[];
  onFilesChange: (files: BlendFile[]) => void;
}

export function BlendFileSelector({ selectedFiles, onFilesChange }: BlendFileSelectorProps) {
  const { electronAPI } = useElectron();

  const handleSelectFiles = async () => {
    if (electronAPI) {
      await electronAPI.selectBlendFiles();
    }
  };

  const handleRemoveFile = (index: number) => {
    const newFiles = selectedFiles.filter((_, i) => i !== index);
    onFilesChange(newFiles);
  };

  React.useEffect(() => {
    if (electronAPI) {
      electronAPI.onBlendFilesSelected((filePaths: string[]) => {
        const newFiles = filePaths.map(path => ({
          path,
          name: path.split('/').pop() || path.split('\\').pop() || path
        }));
        onFilesChange([...selectedFiles, ...newFiles]);
      });

      return () => {
        electronAPI.removeAllListeners('blend-files-selected');
      };
    }
  }, [electronAPI, selectedFiles, onFilesChange]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900">Blend Files</h3>
        <button
          onClick={handleSelectFiles}
          className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-4 h-4 mr-2" />
          Add Files
        </button>
      </div>

      {selectedFiles.length === 0 ? (
        <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
          <FileText className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-500 mb-4">No blend files selected</p>
          <button
            onClick={handleSelectFiles}
            className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-4 h-4 mr-2" />
            Select Blend Files
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          {selectedFiles.map((file, index) => (
            <div
              key={index}
              className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border"
            >
              <div className="flex items-center space-x-3">
                <FileText className="w-5 h-5 text-blue-600" />
                <div>
                  <p className="font-medium text-gray-900">{file.name}</p>
                  <p className="text-sm text-gray-500 truncate max-w-md" title={file.path}>
                    {file.path}
                  </p>
                </div>
              </div>
              <button
                onClick={() => handleRemoveFile(index)}
                className="p-1 text-gray-400 hover:text-red-600 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}