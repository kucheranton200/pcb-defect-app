import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';
import { resolve } from 'path';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CreateDefectDto } from './dto/create-defect.dto';
import { UpdateDefectDto } from './dto/update-defect.dto';
import { DefectsService } from './defects.service';

@Controller('defects')
export class DefectsController {
  constructor(private readonly defectsService: DefectsService) {}

  @Get()
  @UseGuards(JwtAuthGuard)
  findAll() {
    return this.defectsService.findAll();
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  findOne(@Param('id') id: string) {
    return this.defectsService.findOne(id);
  }

  @Get(':id/image')
  async image(@Param('id') id: string, @Res() response: Response) {
    const defect = await this.defectsService.findOne(id);
    return response.sendFile(resolve(defect.imagePath));
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(FileInterceptor('image'))
  create(
    @Body() dto: CreateDefectDto,
    @UploadedFile() image: Express.Multer.File,
  ) {
    return this.defectsService.create(dto, image);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard)
  update(@Param('id') id: string, @Body() dto: UpdateDefectDto) {
    return this.defectsService.update(id, dto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  async remove(@Param('id') id: string) {
    await this.defectsService.remove(id);
    return { success: true };
  }
}
