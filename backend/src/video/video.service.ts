import { Injectable, Logger } from '@nestjs/common';
import { exec } from 'child_process';
import { Response } from 'express';
import {
  createReadStream,
  createWriteStream,
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
  thumbnailUrl: string;
  duration?: number;
  uploadedAt?: Date;
}

export interface StreamInfo {
  filename: string;
  videoPath: string;
  fileSize: number;
  isRangeRequest: boolean;
  start: number;
  end: number;
  chunksize: number;
}

export interface UploadResult {
  success: boolean;
  filename?: string;
  error?: string;
  size?: number;
  sizeFormatted?: string;
}

@Injectable()
export class VideoService {
  private readonly logger = new Logger(VideoService.name);
  private readonly dataPath = join(process.cwd(), 'data');
  private readonly maxFileSize = 500 * 1024 * 1024; // 500MB
  private readonly allowedExtensions = [
    '.mp4',
    '.avi',
    '.mov',
    '.mkv',
    '.webm',
  ];

  async uploadVideo(
    file: Express.Multer.File,
    requestId: string,
  ): Promise<UploadResult> {
    try {
      this.logger.log(
        `[${requestId}] 📤 Starting video upload: ${file.originalname}`,
      );

      // Validate file size
      if (file.size > this.maxFileSize) {
        this.logger.warn(
          `[${requestId}] ⚠️ File too large: ${this.formatBytes(file.size)}`,
        );
        return {
          success: false,
          error: `File size exceeds maximum limit of ${this.formatBytes(this.maxFileSize)}`,
        };
      }

      // Validate file extension
      const fileExtension = file.originalname
        .toLowerCase()
        .substring(file.originalname.lastIndexOf('.'));
      if (!this.allowedExtensions.includes(fileExtension)) {
        this.logger.warn(
          `[${requestId}] ⚠️ Invalid file type: ${fileExtension}`,
        );
        return {
          success: false,
          error: `Invalid file type. Allowed types: ${this.allowedExtensions.join(', ')}`,
        };
      }

      // Generate unique filename
      const timestamp = Date.now();
      const safeFilename = file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
      const filename = `${timestamp}_${safeFilename}`;
      const filePath = join(this.dataPath, filename);

      // Ensure data directory exists
      if (!existsSync(this.dataPath)) {
        mkdirSync(this.dataPath, { recursive: true });
      }

      // Write file to disk
      const writeStream = createWriteStream(filePath);
      writeStream.write(file.buffer);
      writeStream.end();

      await new Promise<void>((resolve, reject) => {
        writeStream.on('finish', () => resolve());
        writeStream.on('error', reject);
      });

      this.logger.log(
        `[${requestId}] ✅ Video uploaded successfully: ${filename}`,
      );

      // Generate thumbnail in background
      this.generateThumbnailForVideo(filename, requestId).catch((error) => {
        this.logger.error(
          `[${requestId}] ❌ Thumbnail generation failed: ${error.message}`,
        );
      });

      return {
        success: true,
        filename,
        size: file.size,
        sizeFormatted: this.formatBytes(file.size),
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`[${requestId}] ❌ Upload failed: ${errorMessage}`);
      return {
        success: false,
        error: 'Failed to upload video',
      };
    }
  }

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

      // Generate thumbnails in the background
      await this.generateThumbnailsForAllVideos(videoInfos);

      return videoInfos;
    } catch (error) {
      console.error('Error reading video directory:', error);
      return [];
    }
  }

  async generateThumbnailsForAllVideos(
    videos: { filename: string }[],
  ): Promise<void> {
    this.logger.log(`🖼️ Generating thumbnails for ${videos.length} videos`);

    for (const video of videos) {
      const requestId = Math.random().toString(36).substring(7);
      try {
        await this.generateThumbnailForVideo(video.filename, requestId);
      } catch (error) {
        this.logger.error(
          `[${requestId}] ❌ Failed to generate thumbnail for ${video.filename}:`,
          error,
        );
      }
    }

    this.logger.log('✅ Thumbnail generation completed for all videos');
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
    } catch {
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

  async generateThumbnailResponse(
    filename: string,
    res: Response,
  ): Promise<void> {
    const requestId = Math.random().toString(36).substring(7);
    this.logger.log(`[${requestId}] 🖼️ Generating thumbnail for: ${filename}`);

    const videoPath = join(this.dataPath, filename);
    const thumbnailsDir = join(this.dataPath, 'thumbnails');
    const jpgThumbnailPath = join(thumbnailsDir, `${filename}.jpg`);
    const svgThumbnailPath = join(thumbnailsDir, `${filename}.svg`);

    // Check if video exists
    if (!existsSync(videoPath)) {
      this.logger.error(`[${requestId}] ❌ Video not found: ${filename}`);
      res.status(404).json({ error: 'Video not found' });
      return;
    }

    // Check if thumbnail already exists
    if (existsSync(jpgThumbnailPath)) {
      this.logger.log(
        `[${requestId}] ✅ JPG thumbnail exists, serving cached version`,
      );
      res.setHeader('Content-Type', 'image/jpeg');
      res.setHeader('Cache-Control', 'public, max-age=3600');
      res.sendFile(jpgThumbnailPath);
      return;
    } else if (existsSync(svgThumbnailPath)) {
      this.logger.log(
        `[${requestId}] ✅ SVG thumbnail exists, serving cached version`,
      );
      res.setHeader('Content-Type', 'image/svg+xml');
      res.setHeader('Cache-Control', 'public, max-age=3600');
      res.sendFile(svgThumbnailPath);
      return;
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
      res.setHeader('Content-Type', 'image/jpeg');
      res.setHeader('Cache-Control', 'public, max-age=3600');
      res.sendFile(jpgThumbnailPath);
    } catch {
      this.logger.log(`[${requestId}] 🔄 Falling back to SVG thumbnail`);
      const svgThumbnail = this.generateSVGThumbnail(filename, fileStats.size);

      // Save SVG thumbnail to file for caching
      writeFileSync(svgThumbnailPath, svgThumbnail);
      this.logger.log(`[${requestId}] 💾 Saved SVG thumbnail to cache`);

      res.setHeader('Content-Type', 'image/svg+xml');
      res.setHeader('Cache-Control', 'public, max-age=3600');
      res.sendFile(svgThumbnailPath);
    }
  }

  getThumbnailPath(filename: string): { path: string; type: string } | null {
    const thumbnailsDir = join(this.dataPath, 'thumbnails');
    const jpgThumbnailPath = join(thumbnailsDir, `${filename}.jpg`);
    const svgThumbnailPath = join(thumbnailsDir, `${filename}.svg`);

    if (existsSync(jpgThumbnailPath)) {
      return { path: jpgThumbnailPath, type: 'image/jpeg' };
    } else if (existsSync(svgThumbnailPath)) {
      return { path: svgThumbnailPath, type: 'image/svg+xml' };
    }

    return null;
  }

  async getVideoInfo(filename: string): Promise<VideoInfo | { error: string }> {
    try {
      const videoPath = join(this.dataPath, filename);
      const fileStats = await stat(videoPath);

      return {
        filename,
        size: fileStats.size,
        sizeFormatted: this.formatFileSize(fileStats.size),
        thumbnailUrl: `/videos/thumbnail/${filename}`,
      };
    } catch {
      return { error: 'Video not found' };
    }
  }

  getStreamInfo(filename: string, range: string | undefined): StreamInfo {
    const videoPath = join(this.dataPath, filename);
    const fileSize = statSync(videoPath).size;

    if (!range) {
      return {
        filename,
        videoPath,
        fileSize,
        isRangeRequest: false,
        start: 0,
        end: fileSize - 1,
        chunksize: fileSize,
      };
    }

    const parts = range.replace(/bytes=/, '').split('-');
    const start = parseInt(parts[0], 10);
    const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
    const chunksize = end - start + 1;

    return {
      filename,
      videoPath,
      fileSize,
      isRangeRequest: true,
      start,
      end,
      chunksize,
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
        error: `Range ${start}-${end} is not satisfiable for file size ${fileSize}`,
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
        'Content-Length': chunksize.toString(),
        'Content-Type': 'video/mp4',
        'Cache-Control': 'no-cache',
      };

      this.logger.log(
        `[${requestId}] 📤 Setting range response headers:`,
        headers,
      );
      res.writeHead(206, headers);
    } else {
      const headers = {
        'Content-Length': fileSize.toString(),
        'Content-Type': 'video/mp4',
        'Accept-Ranges': 'bytes',
        'Cache-Control': 'no-cache',
      };

      this.logger.log(
        `[${requestId}] 📤 Setting full file response headers:`,
        headers,
      );
      res.writeHead(200, headers);
    }
  }

  createVideoStream(streamInfo: StreamInfo, requestId: string) {
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
    file: NodeJS.ReadableStream,
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

  streamVideo(
    filename: string,
    range: string | undefined,
    res: Response,
  ): void {
    const requestId = Math.random().toString(36).substring(7);
    const startTime = Date.now();

    this.logger.log(`[${requestId}] 🎬 Starting video stream for: ${filename}`);

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

      // Handle stream errors
      file.on('error', (error: Error) => {
        this.logger.error(`[${requestId}] ❌ Stream error:`, error.message);
        if (!res.headersSent) {
          res.status(500).json({
            error: 'Streaming error',
            requestId,
            details: error.message,
          });
        } else {
          res.end();
        }
      });

      // Handle client disconnect
      res.on('close', () => {
        this.logger.log(`[${requestId}] 🔌 Client disconnected`);
        file.destroy();
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
    const name = filename.replace(/\.[^/.]+$/, '');

    return `<svg width="320" height="180" xmlns="http://www.w3.org/2000/svg">
      <rect width="320" height="180" fill="#1f2937"/>
      <rect x="10" y="10" width="300" height="160" fill="#374151" rx="8"/>
      <circle cx="160" cy="90" r="25" fill="#6b7280"/>
      <polygon points="150,80 150,100 170,90" fill="white"/>
      <text x="160" y="130" text-anchor="middle" fill="white" font-family="Arial, sans-serif" font-size="12">${name}</text>
      <text x="160" y="145" text-anchor="middle" fill="#9ca3af" font-family="Arial, sans-serif" font-size="10">${sizeFormatted}</text>
    </svg>`;
  }

  formatFileSize(bytes: number): string {
    return this.formatBytes(bytes);
  }

  formatBytes(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }
}
