import { ArrowLeft, Upload } from "lucide-react";
import Link from "next/link";
import VideoUploadForm from "../components/VideoUploadForm";

export default function UploadPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 p-4 shadow-sm">
        <div className="flex items-center gap-4">
          <Link
            href="/"
            className="text-gray-600 hover:text-gray-900 transition-colors"
          >
            <ArrowLeft className="w-6 h-6" />
          </Link>
          <h1 className="text-gray-900 text-lg font-semibold">Upload Video</h1>
        </div>
      </div>

      {/* Upload Form */}
      <div className="max-w-2xl mx-auto p-6">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="text-center mb-6">
            <Upload className="mx-auto h-12 w-12 text-gray-400 mb-4" />
            <h2 className="text-xl font-semibold text-gray-900 mb-2">
              Upload Your Video
            </h2>
            <p className="text-gray-600">
              Choose a video file to upload. Supported formats: MP4, AVI, MOV,
              MKV, WEBM
            </p>
          </div>

          <VideoUploadForm />
        </div>
      </div>
    </div>
  );
}
