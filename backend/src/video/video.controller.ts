import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Post,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';
import { VideoService } from './video.service';

@Controller('videos')
export class VideoController {
  constructor(private readonly videoService: VideoService) {}

  @Get()
  getAllVideos() {
    return this.videoService.getAllVideos();
  }

  @Post('upload')
  @UseInterceptors(
    FileInterceptor('video', {
      storage: undefined, // Use memory storage for chunked processing
      limits: {
        fileSize: 500 * 1024 * 1024, // 500MB limit
      },
    }),
  )
  uploadVideo(@UploadedFile() file: Express.Multer.File) {
    const requestId = Math.random().toString(36).substring(7);
    return this.videoService.uploadVideo(file, requestId);
  }

  @Post('upload-chunk')
  @UseInterceptors(
    FileInterceptor('chunk', {
      storage: undefined,
      limits: {
        fileSize: 2 * 1024 * 1024, // 2MB per chunk
      },
    }),
  )
  async uploadChunk(
    @UploadedFile() chunk: Express.Multer.File,
    @Body()
    body: {
      chunkNumber: string;
      totalChunks: string;
      filename: string;
      fileSize: string;
    },
  ) {
    const requestId = Math.random().toString(36).substring(7);
    const result = await this.videoService.handleChunkUpload(
      chunk,
      body,
      requestId,
    );
    return result;
  }

  @Post('finalize-upload')
  async finalizeUpload(
    @Body() body: { filename: string; totalChunks: string; fileSize: string },
  ) {
    const requestId = Math.random().toString(36).substring(7);
    const result = await this.videoService.finalizeChunkedUpload(
      body,
      requestId,
    );
    return result;
  }

  @Get('thumbnail/:filename')
  generateThumbnail(@Param('filename') filename: string, @Res() res: Response) {
    return this.videoService.generateThumbnailResponse(filename, res);
  }

  @Get('stream/:filename')
  streamVideo(
    @Param('filename') filename: string,
    @Res() res: Response,
    @Headers('range') range: string,
  ) {
    return this.videoService.streamVideo(filename, range, res);
  }

  @Get(':filename')
  getVideoInfo(@Param('filename') filename: string) {
    return this.videoService.getVideoInfo(filename);
  }
}
