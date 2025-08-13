import { Injectable, Logger } from '@nestjs/common';
import { exec } from 'child_process';
import { Response } from 'express';
import {
  createReadStream,
  existsSync,
  mkdirSync,
  statSync,
  writeFileSync,
} from 'fs';
import { readdir, stat } from 'fs/promises';
import { join } from 'path';
import { promisify } from 'util';

const execAsync = promisify(exec);

export interface VideoInfo {
  filename: string;
  size: number;
  sizeFormatted: string;
  duration?: number;
  thumbnailUrl: string;
}

export interface StreamInfo {
  videoPath: string;
  fileSize: number;
  start: number;
  end: number;
  chunksize: number;
  isRangeRequest: boolean;
}

@Injectable()
export class VideoService {
  private readonly logger = new Logger(VideoService.name);
  private readonly dataPath = join(process.cwd(), 'data');

  async getAllVideos(): Promise<VideoInfo[]> {
    try {
      const files = await readdir(this.dataPath);
      const videoFiles = files.filter(
        (file) =>
          file.toLowerCase().endsWith('.mp4') ||
          file.toLowerCase().endsWith('.avi') ||
          file.toLowerCase().endsWith('.mov') ||
          file.toLowerCase().endsWith('.mkv'),
      );

      const videoInfos: VideoInfo[] = [];

      for (const file of videoFiles) {
        const filePath = join(this.dataPath, file);
        const fileStats = await stat(filePath);

        videoInfos.push({
          filename: file,
          size: fileStats.size,
          sizeFormatted: this.formatFileSize(fileStats.size),
          thumbnailUrl: `/videos/thumbnail/${file}`,
        });
      }

      return videoInfos;
    } catch (error) {
      console.error('Error reading video directory:', error);
      return [];
    }
  }

  async getVideoInfo(filename: string): Promise<VideoInfo | null> {
    try {
      const filePath = join(this.dataPath, filename);
      const fileStats = await stat(filePath);

      return {
        filename,
        size: fileStats.size,
        sizeFormatted: this.formatFileSize(fileStats.size),
        thumbnailUrl: `/videos/thumbnail/${filename}`,
      };
    } catch (error) {
      return null;
    }
  }

  async generateThumbnailsForAllVideos(
    videos: { filename: string }[],
  ): Promise<void> {
    const requestId = Math.random().toString(36).substring(7);
    this.logger.log(
      `[${requestId}] 🖼️ Generating thumbnails for ${videos.length} videos`,
    );

    for (const video of videos) {
      try {
        await this.generateThumbnailForVideo(video.filename, requestId);
      } catch (error) {
        this.logger.error(
          `[${requestId}] ❌ Failed to generate thumbnail for ${video.filename}:`,
          error,
        );
      }
    }

    this.logger.log(
      `[${requestId}] ✅ Thumbnail generation completed for all videos`,
    );
  }

  async generateThumbnailForVideo(
    filename: string,
    requestId: string,
  ): Promise<void> {
    const videoPath = join(this.dataPath, filename);
    const thumbnailsDir = join(this.dataPath, 'thumbnails');
    const thumbnailPath = join(thumbnailsDir, `${filename}.jpg`);
    const svgThumbnailPath = join(thumbnailsDir, `${filename}.svg`);

    // Check if thumbnail already exists
    if (existsSync(thumbnailPath) || existsSync(svgThumbnailPath)) {
      this.logger.debug(
        `[${requestId}] ✅ Thumbnail already exists for ${filename}`,
      );
      return;
    }

    // Create thumbnails directory if it doesn't exist
    if (!existsSync(thumbnailsDir)) {
      mkdirSync(thumbnailsDir, { recursive: true });
    }

    // Get video file stats
    const fileStats = await stat(videoPath);

    // Try to generate JPG thumbnail with ffmpegthumbnailer
    try {
      const command = `ffmpegthumbnailer -i "${videoPath}" -o "${thumbnailPath}" -s 320 -t 50% -q 8`;
      await execAsync(command);

      this.logger.debug(
        `[${requestId}] ✅ Generated JPG thumbnail for ${filename}`,
      );
    } catch (error) {
      this.logger.debug(
        `[${requestId}] ⚠️ ffmpegthumbnailer failed for ${filename}, falling back to SVG`,
      );
      // Fallback to SVG thumbnail
      const svgThumbnail = this.generateSVGThumbnail(filename, fileStats.size);
      writeFileSync(svgThumbnailPath, svgThumbnail);
      this.logger.debug(
        `[${requestId}] ✅ Generated SVG thumbnail for ${filename}`,
      );
    }
  }

  async getThumbnailPath(
    filename: string,
  ): Promise<{ path: string; type: string } | null> {
    const videoPath = join(this.dataPath, filename);
    const thumbnailsDir = join(this.dataPath, 'thumbnails');
    const jpgThumbnailPath = join(thumbnailsDir, `${filename}.jpg`);
    const svgThumbnailPath = join(thumbnailsDir, `${filename}.svg`);

    // Check if video exists
    if (!existsSync(videoPath)) {
      return null;
    }

    // Check if thumbnails exist
    if (existsSync(jpgThumbnailPath)) {
      return { path: jpgThumbnailPath, type: 'image/jpeg' };
    } else if (existsSync(svgThumbnailPath)) {
      return { path: svgThumbnailPath, type: 'image/svg+xml' };
    }

    return null;
  }

  async generateThumbnailResponse(
    filename: string,
    requestId: string,
  ): Promise<{ path: string; type: string } | null> {
    const videoPath = join(this.dataPath, filename);
    const thumbnailsDir = join(this.dataPath, 'thumbnails');
    const jpgThumbnailPath = join(thumbnailsDir, `${filename}.jpg`);
    const svgThumbnailPath = join(thumbnailsDir, `${filename}.svg`);

    // Check if video exists
    if (!existsSync(videoPath)) {
      return null;
    }

    // Check if thumbnail already exists
    if (existsSync(jpgThumbnailPath)) {
      this.logger.log(
        `[${requestId}] ✅ JPG thumbnail exists, serving cached version`,
      );
      return { path: jpgThumbnailPath, type: 'image/jpeg' };
    } else if (existsSync(svgThumbnailPath)) {
      this.logger.log(
        `[${requestId}] ✅ SVG thumbnail exists, serving cached version`,
      );
      return { path: svgThumbnailPath, type: 'image/svg+xml' };
    }

    // Create thumbnails directory if it doesn't exist
    if (!existsSync(thumbnailsDir)) {
      mkdirSync(thumbnailsDir, { recursive: true });
    }

    // Get video file stats
    const fileStats = await stat(videoPath);
    this.logger.log(
      `[${requestId}] ✅ Video found! Size: ${this.formatBytes(fileStats.size)}`,
    );

    // Generate thumbnail using ffmpegthumbnailer
    this.logger.log(`[${requestId}] 🔧 Generating thumbnail from video...`);

    try {
      const command = `ffmpegthumbnailer -i "${videoPath}" -o "${jpgThumbnailPath}" -s 320 -t 50% -q 8`;
      await execAsync(command);

      this.logger.log(`[${requestId}] ✅ Thumbnail generated successfully`);
      return { path: jpgThumbnailPath, type: 'image/jpeg' };
    } catch (error) {
      this.logger.log(`[${requestId}] 🔄 Falling back to SVG thumbnail`);
      const svgThumbnail = this.generateSVGThumbnail(filename, fileStats.size);

      // Save SVG thumbnail to file for caching
      writeFileSync(svgThumbnailPath, svgThumbnail);
      this.logger.log(`[${requestId}] 💾 Saved SVG thumbnail to cache`);

      return { path: svgThumbnailPath, type: 'image/svg+xml' };
    }
  }

  getStreamInfo(filename: string, range: string | undefined): StreamInfo {
    const videoPath = join(this.dataPath, filename);
    const stat = statSync(videoPath);
    const fileSize = stat.size;

    if (range) {
      const parts = range.replace(/bytes=/, '').split('-');
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
      const chunksize = end - start + 1;

      return {
        videoPath,
        fileSize,
        start,
        end,
        chunksize,
        isRangeRequest: true,
      };
    }

    return {
      videoPath,
      fileSize,
      start: 0,
      end: fileSize - 1,
      chunksize: fileSize,
      isRangeRequest: false,
    };
  }

  validateRangeRequest(streamInfo: StreamInfo): {
    valid: boolean;
    error?: string;
  } {
    if (!streamInfo.isRangeRequest) {
      return { valid: true };
    }

    const { start, end, fileSize } = streamInfo;

    if (start >= fileSize || end >= fileSize || start > end) {
      return {
        valid: false,
        error: `Invalid range: start=${start}, end=${end}, fileSize=${fileSize}`,
      };
    }

    return { valid: true };
  }

  setupStreamHeaders(
    res: Response,
    streamInfo: StreamInfo,
    requestId: string,
  ): void {
    const { fileSize, start, end, chunksize, isRangeRequest } = streamInfo;

    if (isRangeRequest) {
      const headers = {
        'Content-Range': `bytes ${start}-${end}/${fileSize}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': chunksize,
        'Content-Type': 'video/mp4',
        'Cache-Control': 'no-cache',
        'X-Request-ID': requestId,
      };

      this.logger.log(
        `[${requestId}] 📤 Setting range response headers:`,
        headers,
      );
      res.writeHead(206, headers);
    } else {
      const headers = {
        'Content-Length': fileSize,
        'Content-Type': 'video/mp4',
        'Accept-Ranges': 'bytes',
        'Cache-Control': 'no-cache',
        'X-Request-ID': requestId,
      };

      this.logger.log(
        `[${requestId}] 📤 Setting full file response headers:`,
        headers,
      );
      res.writeHead(200, headers);
    }
  }

  createVideoStream(streamInfo: StreamInfo, requestId: string): any {
    const { videoPath, start, end, isRangeRequest } = streamInfo;

    if (isRangeRequest) {
      this.logger.log(
        `[${requestId}] 🔧 Creating read stream for range ${start}-${end}...`,
      );
      return createReadStream(videoPath, { start, end });
    } else {
      this.logger.log(
        `[${requestId}] 🔧 Creating read stream for full file...`,
      );
      return createReadStream(videoPath);
    }
  }

  setupStreamEventHandlers(
    file: any,
    streamInfo: StreamInfo,
    requestId: string,
    startTime: number,
  ): void {
    const { chunksize, fileSize, isRangeRequest } = streamInfo;

    file.on('open', () => {
      this.logger.log(`[${requestId}] 🚀 File stream opened successfully`);
    });

    file.on('data', (chunk: Buffer) => {
      this.logger.debug(
        `[${requestId}] 📦 Streaming chunk: ${this.formatBytes(chunk.length)}`,
      );
    });

    file.on('error', (error: Error) => {
      this.logger.error(`[${requestId}] ❌ File stream error:`, error.message);
    });

    file.on('end', () => {
      const duration = Date.now() - startTime;
      const bytesSent = isRangeRequest ? chunksize : fileSize;

      this.logger.log(
        `[${requestId}] ✅ ${isRangeRequest ? 'Range' : 'Full file'} streaming completed in ${duration}ms`,
      );
      this.logger.log(`[${requestId}] 📊 Streaming metrics:`);
      this.logger.log(
        `[${requestId}]   - Bytes sent: ${this.formatBytes(bytesSent)}`,
      );
      this.logger.log(`[${requestId}]   - Duration: ${duration}ms`);
      this.logger.log(
        `[${requestId}]   - Speed: ${this.formatBytes(bytesSent / (duration / 1000))}/s`,
      );
    });
  }

  async streamVideo(
    filename: string,
    range: string | undefined,
    res: Response,
    requestId: string,
  ): Promise<void> {
    const startTime = Date.now();

    try {
      this.logger.log(
        `[${requestId}] 📊 Request headers - Range: ${range || 'None'}`,
      );

      const streamInfo = this.getStreamInfo(filename, range);
      this.logger.log(
        `[${requestId}] ✅ File found! Size: ${this.formatBytes(streamInfo.fileSize)}`,
      );

      const validation = this.validateRangeRequest(streamInfo);
      if (!validation.valid) {
        this.logger.warn(`[${requestId}] ⚠️ ${validation.error}`);
        res.status(416).json({
          error: 'Range Not Satisfiable',
          requestId,
          details: validation.error,
        });
        return;
      }

      this.setupStreamHeaders(res, streamInfo, requestId);

      const file = this.createVideoStream(streamInfo, requestId);
      this.setupStreamEventHandlers(file, streamInfo, requestId, startTime);

      file.on('error', (error: Error) => {
        if (!res.headersSent) {
          res.status(500).json({
            error: 'Streaming error',
            requestId,
            details: error.message,
          });
        }
      });

      this.logger.log(`[${requestId}] 🔄 Piping file stream to response...`);
      file.pipe(res);
    } catch (error: unknown) {
      const duration = Date.now() - startTime;
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';

      this.logger.error(
        `[${requestId}] ❌ Video streaming failed after ${duration}ms:`,
        errorMessage,
      );

      if (!res.headersSent) {
        res.status(404).json({
          error: 'Video not found',
          requestId,
          details: {
            filename,
            message: errorMessage,
          },
        });
      }
    }
  }

  private generateSVGThumbnail(filename: string, fileSize: number): string {
    const sizeFormatted = this.formatBytes(fileSize);
    const videoName = filename.replace(/\.[^/.]+$/, ''); // Remove extension

    return `
      <svg width="320" height="240" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="grad1" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" style="stop-color:#667eea;stop-opacity:1" />
            <stop offset="100%" style="stop-color:#764ba2;stop-opacity:1" />
          </linearGradient>
        </defs>
        <rect width="320" height="240" fill="url(#grad1)"/>
        <circle cx="160" cy="100" r="40" fill="rgba(255,255,255,0.2)"/>
        <polygon points="150,80 150,120 180,100" fill="white"/>
        <text x="160" y="160" text-anchor="middle" fill="white" font-family="Arial, sans-serif" font-size="14" font-weight="bold">${videoName}</text>
        <text x="160" y="180" text-anchor="middle" fill="white" font-family="Arial, sans-serif" font-size="12">${sizeFormatted}</text>
        <text x="160" y="200" text-anchor="middle" fill="white" font-family="Arial, sans-serif" font-size="10">Click to play</text>
      </svg>
    `;
  }

  private formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes';

    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  formatBytes(bytes: number): string {
    if (bytes === 0) return '0 Bytes';

    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }
}
