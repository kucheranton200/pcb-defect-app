import {
  Controller,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { InspectionService } from './inspection.service';

@UseGuards(JwtAuthGuard)
@Controller('inspection')
export class InspectionController {
  constructor(private readonly inspectionService: InspectionService) {}

  @Post('video-chunk')
  @UseInterceptors(FileInterceptor('video'))
  inspectVideoChunk(@UploadedFile() video: Express.Multer.File) {
    return this.inspectionService.inspectVideoChunk(video);
  }
}
