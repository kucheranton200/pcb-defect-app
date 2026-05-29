import {
  Body,
  Controller,
  Post,
  Sse,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { InspectionEventsService } from './inspection-events.service';
import { InspectionService } from './inspection.service';

@Controller('inspection')
export class InspectionController {
  constructor(
    private readonly inspectionService: InspectionService,
    private readonly inspectionEvents: InspectionEventsService,
  ) {}

  @Sse('events')
  events() {
    return this.inspectionEvents.events();
  }

  @Post('video-chunk')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(FileInterceptor('video'))
  inspectVideoChunk(@UploadedFile() video: Express.Multer.File) {
    return this.inspectionService.inspectVideoChunk(video);
  }

  @Post('frame-result')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(FileInterceptor('image'))
  acceptFrameResult(
    @UploadedFile() image: Express.Multer.File,
    @Body('detections') detections: string,
  ) {
    return this.inspectionService.acceptFrameResult(image, detections);
  }
}
