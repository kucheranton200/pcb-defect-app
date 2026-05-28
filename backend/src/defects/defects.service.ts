import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Defect } from '@prisma/client';
import { FilesService } from '../files/files.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateDefectDto } from './dto/create-defect.dto';
import { UpdateDefectDto } from './dto/update-defect.dto';

export interface ModelDetection {
  class: string;
  confidence: number;
  box: [number, number, number, number];
}

@Injectable()
export class DefectsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly files: FilesService,
  ) {}

  findAll(): Promise<Defect[]> {
    return this.prisma.defect.findMany({ orderBy: { createdAt: 'desc' } });
  }

  async findOne(id: string): Promise<Defect> {
    const defect = await this.prisma.defect.findUnique({ where: { id } });
    if (!defect) {
      throw new NotFoundException('Defect not found');
    }

    return defect;
  }

  async create(
    dto: CreateDefectDto,
    image: Express.Multer.File,
  ): Promise<Defect> {
    if (!image) {
      throw new BadRequestException('Image file is required');
    }

    const storedFile = await this.files.saveDefectImage(image);

    return this.prisma.defect.create({
      data: {
        ...storedFile,
        className: dto.className,
        confidence: Number(dto.confidence),
        boxX1: Number(dto.boxX1),
        boxY1: Number(dto.boxY1),
        boxX2: Number(dto.boxX2),
        boxY2: Number(dto.boxY2),
      },
    });
  }

  async createFromDetection(
    framePath: string,
    detection: ModelDetection,
  ): Promise<Defect> {
    const storedFile = await this.files.saveDefectImageFromPath(framePath);
    const [boxX1, boxY1, boxX2, boxY2] = detection.box;

    return this.prisma.defect.create({
      data: {
        ...storedFile,
        className: detection.class,
        confidence: detection.confidence,
        boxX1,
        boxY1,
        boxX2,
        boxY2,
      },
    });
  }

  async update(id: string, dto: UpdateDefectDto): Promise<Defect> {
    await this.findOne(id);

    return this.prisma.defect.update({
      where: { id },
      data: dto,
    });
  }

  async remove(id: string): Promise<void> {
    const defect = await this.findOne(id);
    await this.prisma.defect.delete({ where: { id } });
    await this.files.deleteIfExists(defect.imagePath);
  }
}
