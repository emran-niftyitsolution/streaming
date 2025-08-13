import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { VideoController } from './video.controller';
import { VideoService } from './video.service';

@Module({
  imports: [],
  controllers: [AppController, VideoController],
  providers: [AppService, VideoService],
})
export class AppModule {}
