"use client";

import * as Dialog from "@radix-ui/react-dialog";
import * as Progress from "@radix-ui/react-progress";
import axios from "axios";
import { AlertCircle, CheckCircle, Loader2, Upload, X } from "lucide-react";
import { useRef, useState } from "react";

interface UploadResult {
  success: boolean;
  filename?: string;
  error?: string;
  size?: number;
  sizeFormatted?: string;
}

interface VideoUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUploadSuccess: () => void;
}

export default function VideoUploadModal({
  isOpen,
  onClose,
  onUploadSuccess,
}: VideoUploadModalProps) {
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
          handleClose();
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

  const handleClose = () => {
    setUploadResult(null);
    setUploadProgress(0);
    setDragActive(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
    onClose();
  };

  return (
    <Dialog.Root open={isOpen} onOpenChange={handleClose}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50" />
        <Dialog.Content className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-gray-800 rounded-lg p-6 w-full max-w-md z-50">
          <div className="flex items-center justify-between mb-4">
            <Dialog.Title className="text-xl font-semibold text-white">
              Upload Video
            </Dialog.Title>
            <Dialog.Close asChild>
              <button className="text-gray-400 hover:text-white transition-colors">
                <X className="w-5 h-5" />
              </button>
            </Dialog.Close>
          </div>

          <div className="space-y-4">
            {!isUploading && !uploadResult && (
              <div
                className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
                  dragActive
                    ? "border-blue-500 bg-blue-500/10"
                    : "border-gray-600"
                }`}
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
              >
                <Upload className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                <p className="text-gray-400 mb-2">
                  Drag and drop your video file here, or click to browse
                </p>
                <p className="text-sm text-gray-500 mb-4">
                  Supported formats: MP4, AVI, MOV, MKV, WEBM (Max: 500MB)
                </p>

                <button
                  onClick={() => {
                    console.log("Choose File button clicked");
                    if (fileInputRef.current) {
                      console.log("File input found, triggering click");
                      fileInputRef.current.click();
                    } else {
                      console.error("File input ref not found");
                    }
                  }}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg transition-colors"
                >
                  Choose File
                </button>

                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".mp4,.avi,.mov,.mkv,.webm"
                  onChange={(e) => {
                    console.log("File input change event triggered");
                    if (e.target.files && e.target.files[0]) {
                      console.log("File selected:", e.target.files[0].name);
                      handleFileUpload(e.target.files[0]);
                    }
                  }}
                  className="hidden"
                />
              </div>
            )}

            {isUploading && (
              <div className="text-center space-y-4">
                <Loader2 className="mx-auto h-12 w-12 text-blue-500 animate-spin" />
                <h3 className="text-lg font-medium text-white">
                  Uploading Video...
                </h3>
                <div className="space-y-2">
                  <Progress.Root className="w-full bg-gray-700 rounded-full h-2">
                    <Progress.Indicator
                      className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${uploadProgress}%` }}
                    />
                  </Progress.Root>
                  <p className="text-gray-400 text-sm">{uploadProgress}%</p>
                </div>
              </div>
            )}

            {uploadResult && (
              <div className="text-center space-y-4">
                {uploadResult.success ? (
                  <>
                    <CheckCircle className="mx-auto h-12 w-12 text-green-500" />
                    <h3 className="text-lg font-medium text-white">
                      Upload Successful!
                    </h3>
                    <p className="text-gray-400">
                      {uploadResult.filename} ({uploadResult.sizeFormatted})
                    </p>
                    <p className="text-green-400 text-sm">
                      Video uploaded successfully. Refreshing video list...
                    </p>
                  </>
                ) : (
                  <>
                    <AlertCircle className="mx-auto h-12 w-12 text-red-500" />
                    <h3 className="text-lg font-medium text-white">
                      Upload Failed
                    </h3>
                    <p className="text-red-400">{uploadResult.error}</p>
                    <button
                      onClick={() => {
                        setUploadResult(null);
                        setUploadProgress(0);
                      }}
                      className="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded-lg transition-colors"
                    >
                      Try Again
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
