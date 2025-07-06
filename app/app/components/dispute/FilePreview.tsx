"use client";

import React, { useEffect, useState } from "react";

interface FilePreviewProps {
  file: File;
  onRemove: () => void;
}

const FilePreview: React.FC<FilePreviewProps> = ({ file, onRemove }) => {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    console.log(
      `[FilePreview] Processing file: ${file.name}, type: ${file.type}, size: ${file.size}`
    );

    if (file && file.type.startsWith("image/")) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result as string;
        console.log(
          `[FilePreview] Generated Data URL for ${file.name} (length: ${
            result.length
          }). Preview (first 100 chars): ${result.substring(0, 100)}...`
        );
        setPreviewUrl(result);
        setError(null);
      };
      reader.onerror = (error) => {
        console.error(`[FilePreview] Error reading file ${file.name}:`, error);
        setError("Failed to read file");
        setPreviewUrl(null);
      };
      reader.readAsDataURL(file);
    } else {
      console.log(
        `[FilePreview] File ${file.name} is not an image, skipping preview`
      );
      setPreviewUrl(null);
      setError(null);
    }
  }, [file]);

  return (
    <div className="relative w-24 h-24 bg-gray-100 rounded-md overflow-hidden border">
      {error && (
        <div className="absolute top-0 left-0 right-0 bg-red-500 text-white text-xs p-1 text-center z-10">
          Error
        </div>
      )}
      {previewUrl ? (
        <>
          <img
            src={previewUrl}
            alt={file.name}
            className="w-full h-full object-cover"
            onLoad={() =>
              console.log(
                `[FilePreview] Image loaded successfully for ${file.name}`
              )
            }
            onError={(e) => {
              console.error(
                `[FilePreview] Image failed to load for ${file.name}:`,
                e
              );
              setError("Image load failed");
            }}
          />
          <button
            onClick={onRemove}
            className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1 w-6 h-6 flex items-center justify-center hover:bg-red-600 z-10"
            aria-label="Remove file"
          >
            &times;
          </button>
          <div className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-50 text-white text-xs p-1 truncate">
            {file.name}
          </div>
        </>
      ) : (
        <div className="w-full h-full flex items-center justify-center text-gray-400">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-8 w-8"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
            />
          </svg>
        </div>
      )}
    </div>
  );
};

export default FilePreview;
