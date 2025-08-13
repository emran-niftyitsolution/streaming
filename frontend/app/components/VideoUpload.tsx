"use client";

import axios from "axios";
import { AlertCircle, CheckCircle, Loader2, Upload } from "lucide-react";
import { useRef, useState } from "react";

interface UploadResult {
  success: boolean;
  filename?: string;
  error?: string;
  size?: number;
  sizeFormatted?: string;
}

interface VideoUploadProps {
  onUploadSuccess: () => void;
}

export default function VideoUpload({ onUploadSuccess }: VideoUploadProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadResult, setUploadResult] = useState<UploadResult | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const maxFileSize = 500 * 1024 * 1024; // 500MB
  const allowedTypes = [".mp4", ".avi", ".mov", ".mkv", ".webm"];

  const validateFile = (file: File): string | null => {
    if (file.size > maxFileSize) {
      return `File size exceeds maximum limit of ${formatBytes(maxFileSize)}`;
    }

    const fileExtension = file.name
      .toLowerCase()
      .substring(file.name.lastIndexOf("."));
    if (!allowedTypes.includes(fileExtension)) {
      return `Invalid file type. Allowed types: ${allowedTypes.join(", ")}`;
    }

    return null;
  };

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  const handleFileUpload = async (file: File) => {
    const validationError = validateFile(file);
    if (validationError) {
      setUploadResult({ success: false, error: validationError });
      return;
    }

    setIsUploading(true);
    setUploadProgress(0);
    setUploadResult(null);

    try {
      // Create FormData
      const formData = new FormData();
      formData.append("video", file);

      // Upload with progress tracking
      const response = await axios.post(
        "http://localhost:5001/videos/upload",
        formData,
        {
          headers: {
            "Content-Type": "multipart/form-data",
          },
          onUploadProgress: (progressEvent) => {
            if (progressEvent.total) {
              const progress = Math.round(
                (progressEvent.loaded * 100) / progressEvent.total
              );
              setUploadProgress(progress);
            }
          },
        }
      );

      if (response.data.success) {
        setUploadResult(response.data);
        setTimeout(() => {
          onUploadSuccess();
          setUploadResult(null);
          setUploadProgress(0);
        }, 2000);
      } else {
        setUploadResult(response.data);
      }
    } catch (error) {
      setUploadResult({
        success: false,
        error: "Upload failed. Please try again.",
      });
    } finally {
      setIsUploading(false);
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileUpload(e.dataTransfer.files[0]);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFileUpload(e.target.files[0]);
    }
  };

  const resetUpload = () => {
    setUploadResult(null);
    setUploadProgress(0);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  return (
    <div className="w-full max-w-2xl mx-auto p-6">
      <div className="bg-gray-800 rounded-lg border-2 border-dashed border-gray-600 p-8 relative">
        {!isUploading && !uploadResult && (
          <>
            <div className="text-center">
              <Upload className="mx-auto h-12 w-12 text-gray-400 mb-4" />
              <h3 className="text-lg font-medium text-white mb-2">
                Upload Video
              </h3>
              <p className="text-gray-400 mb-4">
                Drag and drop your video file here, or click to browse
              </p>
              <p className="text-sm text-gray-500 mb-6">
                Supported formats: MP4, AVI, MOV, MKV, WEBM (Max: 500MB)
              </p>

              <button
                onClick={() => {
                  console.log('Choose File button clicked');
                  if (fileInputRef.current) {
                    console.log('File input found, triggering click');
                    fileInputRef.current.click();
                  } else {
                    console.error('File input ref not found');
                  }
                }}
                className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg transition-colors"
              >
                Choose File
              </button>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept=".mp4,.avi,.mov,.mkv,.webm"
              onChange={(e) => {
                console.log('File input change event triggered');
                if (e.target.files && e.target.files[0]) {
                  console.log('File selected:', e.target.files[0].name);
                  handleFileUpload(e.target.files[0]);
                }
              }}
              className="hidden"
            />
          </>
        )}

        {isUploading && (
          <div className="text-center">
            <Loader2 className="mx-auto h-12 w-12 text-blue-500 animate-spin mb-4" />
            <h3 className="text-lg font-medium text-white mb-2">
              Uploading Video...
            </h3>
            <div className="w-full bg-gray-700 rounded-full h-2 mb-4">
              <div
                className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${uploadProgress}%` }}
              />
            </div>
            <p className="text-gray-400">{uploadProgress}%</p>
          </div>
        )}

        {uploadResult && (
          <div className="text-center">
            {uploadResult.success ? (
              <>
                <CheckCircle className="mx-auto h-12 w-12 text-green-500 mb-4" />
                <h3 className="text-lg font-medium text-white mb-2">
                  Upload Successful!
                </h3>
                <p className="text-gray-400 mb-4">
                  {uploadResult.filename} ({uploadResult.sizeFormatted})
                </p>
                <p className="text-green-400 text-sm">
                  Video uploaded successfully. Refreshing video list...
                </p>
              </>
            ) : (
              <>
                <AlertCircle className="mx-auto h-12 w-12 text-red-500 mb-4" />
                <h3 className="text-lg font-medium text-white mb-2">
                  Upload Failed
                </h3>
                <p className="text-red-400 mb-4">{uploadResult.error}</p>
                <button
                  onClick={resetUpload}
                  className="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded-lg transition-colors"
                >
                  Try Again
                </button>
              </>
            )}
          </div>
        )}

        <div
          className={`absolute inset-0 rounded-lg transition-colors ${
            dragActive ? "bg-blue-500 bg-opacity-10 border-blue-500" : ""
          }`}
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
        />
      </div>
    </div>
  );
}
