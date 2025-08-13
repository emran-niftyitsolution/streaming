import axios from "axios";
import { Play } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

interface VideoInfo {
  filename: string;
  size: number;
  sizeFormatted: string;
  thumbnailUrl: string;
}

async function getVideos(): Promise<VideoInfo[]> {
  try {
    const response = await axios.get("http://localhost:5001/videos");
    return response.data;
  } catch (error) {
    console.error("Error fetching videos:", error);
    return [];
  }
}

export default async function Home() {
  const videos = await getVideos();

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Video Streamer</h1>
          <Link
            href="/upload"
            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg transition-colors"
          >
            Upload Video
          </Link>
        </div>

        {videos.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {videos.map((video) => (
              <Link
                key={video.filename}
                href={`/video/${video.filename}`}
                className="bg-white rounded-lg overflow-hidden cursor-pointer hover:bg-gray-50 transition-colors shadow-sm border border-gray-200 group"
              >
                <div
                  className="relative bg-gray-100"
                  style={{ height: "200px", minHeight: "200px" }}
                >
                  <Image
                    src={`http://localhost:5001${video.thumbnailUrl}`}
                    alt={video.filename}
                    fill
                    className="object-cover"
                  />
                  <div className="absolute inset-0 group-hover:bg-black/20 transition-all duration-200 flex items-center justify-center">
                    <Play className="w-12 h-12 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                </div>
                <div className="p-4">
                  <h3 className="text-gray-900 font-semibold text-sm mb-2 truncate">
                    {video.filename.replace(/\.[^/.]+$/, "")}
                  </h3>
                  <div className="flex items-center justify-between text-gray-500 text-xs">
                    <span>{video.sizeFormatted}</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="text-center py-12">
            <div className="text-gray-500 text-lg">No videos found</div>
            <p className="text-gray-400 mt-2">
              Add some videos to the data folder to get started
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
