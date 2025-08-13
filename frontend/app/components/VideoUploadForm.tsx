"use client";

import * as Progress from "@radix-ui/react-progress";
import axios from "axios";
import { AlertCircle, CheckCircle, Loader2, Upload } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

interface UploadResult {
  success: boolean;
  filename?: string;
  error?: string;
  size?: number;
  sizeFormatted?: string;
}

interface ChunkInfo {
  chunkNumber: number;
  totalChunks: number;
  chunkSize: number;
  totalSize: number;
}

export default function VideoUploadForm() {
  const router = useRouter();
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadResult, setUploadResult] = useState<UploadResult | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [chunkInfo, setChunkInfo] = useState<ChunkInfo | null>(null);
  const [currentChunk, setCurrentChunk] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const maxFileSize = 500 * 1024 * 1024; // 500MB
  const allowedTypes = [".mp4", ".avi", ".mov", ".mkv", ".webm"];
  const chunkSize = 1024 * 1024; // 1MB chunks

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

  const createChunks = (file: File): Blob[] => {
    const chunks: Blob[] = [];
    let start = 0;

    while (start < file.size) {
      const end = Math.min(start + chunkSize, file.size);
      const chunk = file.slice(start, end);
      chunks.push(chunk);
      start = end;
    }

    return chunks;
  };

  const uploadChunk = async (
    chunk: Blob,
    chunkNumber: number,
    totalChunks: number,
    filename: string,
    fileSize: number
  ): Promise<boolean> => {
    const formData = new FormData();
    formData.append("chunk", chunk);
    formData.append("chunkNumber", chunkNumber.toString());
    formData.append("totalChunks", totalChunks.toString());
    formData.append("filename", filename);
    formData.append("fileSize", fileSize.toString());

    try {
      const response = await axios.post(
        "http://localhost:5001/videos/upload-chunk",
        formData,
        {
          headers: {
            "Content-Type": "multipart/form-data",
          },
        }
      );

      return response.data.success;
    } catch (error) {
      console.error(`Chunk ${chunkNumber} upload failed:`, error);
      return false;
    }
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
    setCurrentChunk(0);

    try {
      // Create chunks
      const chunks = createChunks(file);
      const totalChunks = chunks.length;
      const timestamp = Date.now();
      const safeFilename = file.name.replace(/[^a-zA-Z0-9.-]/g, "_");
      const filename = `${timestamp}_${safeFilename}`;

      setChunkInfo({
        chunkNumber: 0,
        totalChunks,
        chunkSize,
        totalSize: file.size,
      });

      console.log(
        `🚀 Starting chunked upload: ${totalChunks} chunks of ${formatBytes(
          chunkSize
        )} each`
      );

      // Upload chunks sequentially
      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        const chunkNumber = i + 1;

        setCurrentChunk(chunkNumber);
        console.log(
          `📤 Uploading chunk ${chunkNumber}/${totalChunks} (${formatBytes(
            chunk.size
          )})`
        );

        const success = await uploadChunk(
          chunk,
          chunkNumber,
          totalChunks,
          filename,
          file.size
        );

        if (!success) {
          throw new Error(`Failed to upload chunk ${chunkNumber}`);
        }

        // Update progress
        const progress = Math.round(((i + 1) / totalChunks) * 100);
        setUploadProgress(progress);
        setChunkInfo((prev) => (prev ? { ...prev, chunkNumber } : null));

        console.log(
          `✅ Chunk ${chunkNumber}/${totalChunks} uploaded successfully (${progress}%)`
        );
      }

      // Finalize upload
      console.log("🎉 All chunks uploaded, finalizing...");
      const finalizeResponse = await axios.post(
        "http://localhost:5001/videos/finalize-upload",
        {
          filename,
          totalChunks,
          fileSize: file.size,
        }
      );

      if (finalizeResponse.data.success) {
        setUploadResult({
          success: true,
          filename: finalizeResponse.data.filename,
          size: file.size,
          sizeFormatted: formatBytes(file.size),
        });

        setTimeout(() => {
          router.push("/");
        }, 2000);
      } else {
        throw new Error("Failed to finalize upload");
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Upload failed";
      setUploadResult({ success: false, error: errorMessage });
      console.error("❌ Chunked upload failed:", error);
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
    setDragActive(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  return (
    <div className="space-y-6">
      {!isUploading && !uploadResult && (
        <div
          className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
            dragActive ? "border-blue-500 bg-blue-50" : "border-gray-300"
          }`}
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
        >
          <Upload className="mx-auto h-12 w-12 text-gray-400 mb-4" />
          <p className="text-gray-600 mb-2">
            Drag and drop your video file here, or click to browse
          </p>
          <p className="text-sm text-gray-500 mb-4">
            Supported formats: MP4, AVI, MOV, MKV, WEBM (Max: 500MB)
          </p>

          <button
            onClick={() => fileInputRef.current?.click()}
            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg transition-colors"
          >
            Choose File
          </button>

          <input
            ref={fileInputRef}
            type="file"
            accept=".mp4,.avi,.mov,.mkv,.webm"
            onChange={handleFileSelect}
            className="hidden"
          />
        </div>
      )}

      {isUploading && (
        <div className="text-center space-y-4">
          <Loader2 className="mx-auto h-12 w-12 text-blue-500 animate-spin" />
          <h3 className="text-lg font-medium text-gray-900">
            Uploading Video...
          </h3>
          <div className="space-y-2">
            <Progress.Root className="w-full bg-gray-200 rounded-full h-2">
              <Progress.Indicator
                className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${uploadProgress}%` }}
              />
            </Progress.Root>
            <div className="flex justify-between text-sm text-gray-600">
              <span>{uploadProgress}%</span>
              {chunkInfo && (
                <span>
                  Chunk {currentChunk}/{chunkInfo.totalChunks}
                </span>
              )}
            </div>
            {chunkInfo && (
              <div className="text-xs text-gray-500 space-y-1">
                <p>File: {formatBytes(chunkInfo.totalSize)}</p>
                <p>Chunk Size: {formatBytes(chunkInfo.chunkSize)}</p>
                <p>
                  Progress: {formatBytes(currentChunk * chunkInfo.chunkSize)} /{" "}
                  {formatBytes(chunkInfo.totalSize)}
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {uploadResult && (
        <div className="text-center space-y-4">
          {uploadResult.success ? (
            <>
              <CheckCircle className="mx-auto h-12 w-12 text-green-500" />
              <h3 className="text-lg font-medium text-gray-900">
                Upload Successful!
              </h3>
              <p className="text-gray-600">
                {uploadResult.filename} ({uploadResult.sizeFormatted})
              </p>
              <p className="text-green-600 text-sm">
                Video uploaded successfully. Redirecting to home...
              </p>
            </>
          ) : (
            <>
              <AlertCircle className="mx-auto h-12 w-12 text-red-500" />
              <h3 className="text-lg font-medium text-gray-900">
                Upload Failed
              </h3>
              <p className="text-red-600">{uploadResult.error}</p>
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
    </div>
  );
}
