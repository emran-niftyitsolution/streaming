"use client";

import axios from "axios";
import {
  ArrowLeft,
  Maximize,
  Pause,
  Play,
  Volume2,
  VolumeX,
} from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

interface VideoInfo {
  filename: string;
  size: number;
  sizeFormatted: string;
  duration?: number;
  thumbnailUrl: string;
}

export default function VideoPage() {
  const params = useParams();
  const router = useRouter();
  const filename = params.filename as string;
  const videoRef = useRef<HTMLVideoElement>(null);

  const [videoInfo, setVideoInfo] = useState<VideoInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [showControls, setShowControls] = useState(true);
  const [buffering, setBuffering] = useState(false);
  const [bufferedProgress, setBufferedProgress] = useState(0);
  const [chunkInfo, setChunkInfo] = useState({ loaded: 0, total: 0 });

  useEffect(() => {
    const fetchVideoInfo = async () => {
      try {
        setLoading(true);
        const response = await axios.get(
          `http://localhost:5001/videos/${filename}`
        );

        if (response.data.error) {
          setError("Video not found");
        } else {
          setVideoInfo(response.data);
        }
      } catch (err) {
        setError("Failed to load video information");
        console.error("Error fetching video info:", err);
      } finally {
        setLoading(false);
      }
    };

    if (filename) {
      fetchVideoInfo();
    }
  }, [filename]);

  // Handle autoplay after video info is loaded
  useEffect(() => {
    if (videoRef.current && videoInfo && !isPlaying) {
      videoRef.current.play().catch(() => {
        console.log("Autoplay prevented by browser");
      });
    }
  }, [videoInfo, isPlaying]);

  const handleTimeUpdate = (e: React.SyntheticEvent<HTMLVideoElement>) => {
    const video = e.currentTarget;
    setCurrentTime(video.currentTime);
    setDuration(video.duration);
  };

  const handlePlayPause = () => {
    const video = document.querySelector("video") as HTMLVideoElement;
    if (video) {
      if (isPlaying) {
        video.pause();
      } else {
        video.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const handleMuteToggle = () => {
    const video = document.querySelector("video") as HTMLVideoElement;
    if (video) {
      video.muted = !isMuted;
      setIsMuted(!isMuted);
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const video = document.querySelector("video") as HTMLVideoElement;
    if (video) {
      const time = (parseFloat(e.target.value) / 100) * duration;
      video.currentTime = time;
      setCurrentTime(time);
    }
  };

  const handleFullscreen = () => {
    const video = document.querySelector("video") as HTMLVideoElement;
    if (video) {
      if (document.fullscreenElement) {
        document.exitFullscreen();
      } else {
        video.requestFullscreen();
      }
    }
  };

  // Handle chunked streaming events
  const handleWaiting = () => {
    setBuffering(true);
    console.log("🔄 Video waiting for chunks...");
  };

  const handleCanPlay = () => {
    setBuffering(false);
    console.log("✅ Video can play - chunks loaded");
  };

  const handleProgress = () => {
    const video = document.querySelector("video") as HTMLVideoElement;
    if (video && video.buffered.length > 0) {
      const bufferedEnd = video.buffered.end(video.buffered.length - 1);
      const progress = (bufferedEnd / duration) * 100;
      setBufferedProgress(progress);

      // Calculate chunk information
      const loaded =
        video.buffered.length > 0
          ? video.buffered.end(video.buffered.length - 1)
          : 0;
      setChunkInfo({ loaded, total: duration });

      console.log(
        `📊 Chunked progress: ${progress.toFixed(1)}% (${loaded.toFixed(
          1
        )}s / ${duration.toFixed(1)}s)`
      );
    }
  };

  const handleLoadStart = () => {
    console.log("🚀 Starting chunked video load...");
  };

  const handleLoadedData = () => {
    console.log("📦 Initial chunks loaded");
  };

  const formatTime = (time: number) => {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
  };

  const progressPercentage = duration > 0 ? (currentTime / duration) * 100 : 0;

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-600 text-xl">Loading video...</div>
      </div>
    );
  }

  if (error || !videoInfo) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-500 text-xl mb-4">
            {error || "Video not found"}
          </div>
          <button
            onClick={() => router.push("/")}
            className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 mx-auto"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Home
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 p-4 shadow-sm">
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.push("/")}
            className="text-gray-600 hover:text-gray-900 transition-colors"
          >
            <ArrowLeft className="w-6 h-6" />
          </button>
          <h1 className="text-gray-900 text-lg font-semibold truncate">
            {videoInfo.filename.replace(/\.[^/.]+$/, "")}
          </h1>
        </div>
      </div>

      {/* Video Player */}
      <div className="relative max-w-6xl mx-auto p-4">
        <div className="relative bg-black rounded-lg overflow-hidden shadow-lg">
          <video
            ref={videoRef}
            className="w-full h-auto"
            controls={false}
            onTimeUpdate={handleTimeUpdate}
            onPlay={() => setIsPlaying(true)}
            onPause={() => setIsPlaying(false)}
            onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
            onMouseMove={() => setShowControls(true)}
            onMouseLeave={() => setShowControls(false)}
            onWaiting={handleWaiting}
            onCanPlay={handleCanPlay}
            onProgress={handleProgress}
            preload="metadata"
          >
            <source
              src={`http://localhost:5001/videos/stream/${videoInfo.filename}`}
              type="video/mp4"
            />
            Your browser does not support the video tag.
          </video>

          {/* Custom Controls Overlay */}
          <div
            className={`absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent transition-opacity duration-300 ${
              showControls ? "opacity-100" : "opacity-0"
            }`}
            onMouseMove={() => setShowControls(true)}
          >
            {/* Buffering Indicator */}
            {buffering && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                <div className="text-white text-center">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-2"></div>
                  <p className="text-sm">Loading chunks...</p>
                </div>
              </div>
            )}

            {/* Center Play/Pause Button */}
            <div className="absolute inset-0 flex items-center justify-center">
              <button
                onClick={handlePlayPause}
                className="bg-white/20 hover:bg-white/30 text-white p-4 rounded-full backdrop-blur-sm transition-all duration-200"
              >
                {isPlaying ? (
                  <Pause className="w-12 h-12" />
                ) : (
                  <Play className="w-12 h-12 ml-1" />
                )}
              </button>
            </div>

            {/* Bottom Controls */}
            <div className="absolute bottom-0 left-0 right-0 p-4">
              {/* Progress Bar */}
              <div className="mb-4">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-white text-xs">
                    {formatTime(currentTime)} / {formatTime(duration)}
                  </span>
                  <span className="text-gray-300 text-xs">
                    Buffered: {bufferedProgress.toFixed(1)}%
                  </span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={duration > 0 ? (currentTime / duration) * 100 : 0}
                  onChange={handleSeek}
                  className="w-full h-1 bg-gray-600 rounded-lg appearance-none cursor-pointer slider"
                />
                {/* Buffering Progress Bar */}
                <div className="w-full h-1 bg-gray-800 rounded-lg mt-1">
                  <div
                    className="h-full bg-blue-500 rounded-lg transition-all duration-300"
                    style={{ width: `${bufferedProgress}%` }}
                  ></div>
                </div>
              </div>

              {/* Control Buttons */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <button
                    onClick={handlePlayPause}
                    className="text-white hover:text-gray-300 transition-colors"
                  >
                    {isPlaying ? (
                      <Pause className="w-6 h-6" />
                    ) : (
                      <Play className="w-6 h-6" />
                    )}
                  </button>

                  <button
                    onClick={handleMuteToggle}
                    className="text-white hover:text-gray-300 transition-colors"
                  >
                    {isMuted ? (
                      <VolumeX className="w-6 h-6" />
                    ) : (
                      <Volume2 className="w-6 h-6" />
                    )}
                  </button>
                </div>

                <button
                  onClick={handleFullscreen}
                  className="text-white hover:text-gray-300 transition-colors"
                >
                  <Maximize className="w-6 h-6" />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Video Info */}
        <div className="mt-6 bg-white rounded-lg p-4 shadow-sm border border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900 mb-2">
            {videoInfo.filename.replace(/\.[^/.]+$/, "")}
          </h2>
          <div className="text-gray-600 text-sm">
            <p>Size: {videoInfo.sizeFormatted}</p>
            {videoInfo.duration && (
              <p>Duration: {Math.round(videoInfo.duration)} seconds</p>
            )}
          </div>
          {/* Chunk Information */}
          <div className="mt-2 text-gray-400 text-xs">
            <span>
              Chunked Streaming: {chunkInfo.loaded.toFixed(1)}s /{" "}
              {chunkInfo.total.toFixed(1)}s loaded
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
