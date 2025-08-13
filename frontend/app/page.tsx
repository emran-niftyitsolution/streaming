"use client";

import axios from "axios";
import { Play } from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import VideoUpload from "./components/VideoUpload";

interface VideoInfo {
  filename: string;
  size: number;
  sizeFormatted: string;
  thumbnailUrl: string;
}

export default function Home() {
  const [videos, setVideos] = useState<VideoInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showUpload, setShowUpload] = useState(false);
  const router = useRouter();

  const fetchVideos = async () => {
    try {
      setLoading(true);
      const response = await axios.get("http://localhost:5001/videos");
      setVideos(response.data);
    } catch (err) {
      setError("Failed to load videos");
      console.error("Error fetching videos:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchVideos();
  }, []);

  const handleVideoClick = (filename: string) => {
    router.push(`/video/${filename}`);
  };

  const handleUploadSuccess = () => {
    fetchVideos();
    setShowUpload(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-white text-xl">Loading videos...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-400 text-xl mb-4">{error}</div>
          <button
            onClick={fetchVideos}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold text-white">Video Streamer</h1>
          <button
            onClick={() => setShowUpload(!showUpload)}
            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg transition-colors"
          >
            {showUpload ? "Cancel Upload" : "Upload Video"}
          </button>
        </div>

        {showUpload && (
          <div className="mb-8">
            <VideoUpload onUploadSuccess={handleUploadSuccess} />
          </div>
        )}

        {videos.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {videos.map((video) => (
              <div
                key={video.filename}
                className="bg-gray-800 rounded-lg overflow-hidden cursor-pointer hover:bg-gray-700 transition-colors"
                onClick={() => handleVideoClick(video.filename)}
              >
                <div
                  className="relative bg-gray-700"
                  style={{ height: "200px", minHeight: "200px" }}
                >
                  <Image
                    src={`http://localhost:5001${video.thumbnailUrl}`}
                    alt={video.filename}
                    fill
                    className="object-cover"
                  />
                  <div className="absolute inset-0  bg-opacity-0 hover:bg-opacity-30 transition-all duration-200 flex items-center justify-center">
                    <Play className="w-12 h-12 text-white opacity-0 hover:opacity-100 transition-opacity" />
                  </div>
                </div>
                <div className="p-4">
                  <h3 className="text-white font-semibold text-sm mb-2 truncate">
                    {video.filename.replace(/\.[^/.]+$/, "")}
                  </h3>
                  <div className="flex items-center justify-between text-gray-400 text-xs">
                    <span>{video.sizeFormatted}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-12">
            <div className="text-gray-400 text-lg">No videos found</div>
            <p className="text-gray-500 mt-2">
              Add some videos to the data folder to get started
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
