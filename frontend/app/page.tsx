"use client";

import axios from "axios";
import { Play } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

interface VideoInfo {
  filename: string;
  size: number;
  sizeFormatted: string;
  duration?: number;
  thumbnailUrl: string;
}

export default function Home() {
  const [videos, setVideos] = useState<VideoInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    fetchVideos();
  }, []);

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

  const handleVideoClick = (filename: string) => {
    router.push(`/video/${filename}`);
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
          <div className="text-white text-xl mb-4">{error}</div>
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
    <div className="min-h-screen bg-gray-900">
      {/* Header */}
      <div className="bg-gray-800 border-b border-gray-700 p-6">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-3xl font-bold text-white">Video Streaming App</h1>
          <p className="text-gray-300 mt-2">Watch your favorite videos</p>
        </div>
      </div>

      {/* Video Grid */}
      <div className="max-w-7xl mx-auto p-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
          {videos.map((video) => (
            <div
              key={video.filename}
              className="bg-gray-800 rounded-lg overflow-hidden hover:bg-gray-700 transition-colors cursor-pointer group"
              onClick={() => handleVideoClick(video.filename)}
            >
              {/* Thumbnail */}
              <div className="relative bg-gray-200 h-48 flex items-center justify-center overflow-hidden">
                <img
                  src={`http://localhost:5001${video.thumbnailUrl}`}
                  alt={video.filename}
                  className="w-full h-full object-cover"
                  onLoad={(e) => {
                    const img = e.currentTarget;
                    img.style.display = "block";
                  }}
                  onError={(e) => {
                    const img = e.currentTarget;
                    img.style.display = "none";
                  }}
                />
                <div className="absolute inset-0 flex items-center justify-center">
                  <Play className="h-16 w-16 text-gray-400 group-hover:text-white transition-colors" />
                </div>
              </div>

              {/* Video Info */}
              <div className="p-4">
                <h3 className="text-white font-semibold text-sm mb-2 truncate">
                  {video.filename.replace(/\.[^/.]+$/, "")}
                </h3>
                <div className="flex items-center justify-between text-gray-400 text-xs">
                  <span>{video.sizeFormatted}</span>
                  {video.duration && (
                    <span>
                      {Math.floor(video.duration / 60)}:
                      {(video.duration % 60).toString().padStart(2, "0")}
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>

        {videos.length === 0 && !loading && (
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
