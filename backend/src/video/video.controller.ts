import {
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
  @UseInterceptors(FileInterceptor('video'))
  uploadVideo(@UploadedFile() file: Express.Multer.File) {
    const requestId = Math.random().toString(36).substring(7);
    return this.videoService.uploadVideo(file, requestId);
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
