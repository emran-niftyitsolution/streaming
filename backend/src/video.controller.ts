import { Controller, Get, Headers, Logger, Param, Res } from '@nestjs/common';
import { Response } from 'express';
import { VideoService } from './video.service';

@Controller('videos')
export class VideoController {
  private readonly logger = new Logger(VideoController.name);

  constructor(private readonly videoService: VideoService) {}

  @Get()
  async getAllVideos() {
    const videos = await this.videoService.getAllVideos();
    this.videoService.generateThumbnailsForAllVideos(videos);
    return videos;
  }

  @Get('thumbnail/:filename')
  async generateThumbnail(
    @Param('filename') filename: string,
    @Res() res: Response,
  ) {
    const requestId = Math.random().toString(36).substring(7);
    this.logger.log(`[${requestId}] 🖼️ Generating thumbnail for: ${filename}`);

    const thumbnailResult = await this.videoService.generateThumbnailResponse(
      filename,
      requestId,
    );

    if (!thumbnailResult) {
      this.logger.error(`[${requestId}] ❌ Video not found: ${filename}`);
      return res.status(404).json({ error: 'Video not found' });
    }

    res.setHeader('Content-Type', thumbnailResult.type);
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.sendFile(thumbnailResult.path);
  }

  @Get('stream/:filename')
  async streamVideo(
    @Param('filename') filename: string,
    @Res() res: Response,
    @Headers('range') range: string,
  ) {
    const requestId = Math.random().toString(36).substring(7);
    this.logger.log(`[${requestId}] 🎬 Starting video stream for: ${filename}`);

    await this.videoService.streamVideo(filename, range, res, requestId);
  }

  @Get(':filename')
  async getVideoInfo(@Param('filename') filename: string) {
    const videoInfo = await this.videoService.getVideoInfo(filename);
    return videoInfo || { error: 'Video not found' };
  }
}
