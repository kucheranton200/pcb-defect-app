import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import { promises as fs } from 'fs';
import { extname, join } from 'path';

export interface StoredFile {
  imagePath: string;
  imageName: string;
}

@Injectable()
export class FilesService {
  constructor(private readonly config: ConfigService) {}

  async saveDefectImage(file: Express.Multer.File): Promise<StoredFile> {
    const dir = this.config.get<string>('FILES_DIR', 'storage/defects');
    await fs.mkdir(dir, { recursive: true });

    const ext = extname(file.originalname) || '.jpg';
    const imageName = `${randomUUID()}${ext}`;
    const imagePath = join(dir, imageName);

    await fs.writeFile(imagePath, file.buffer);

    return { imagePath, imageName };
  }

  async saveDefectImageFromPath(sourcePath: string): Promise<StoredFile> {
    const dir = this.config.get<string>('FILES_DIR', 'storage/defects');
    await fs.mkdir(dir, { recursive: true });

    const ext = extname(sourcePath) || '.jpg';
    const imageName = `${randomUUID()}${ext}`;
    const imagePath = join(dir, imageName);

    await fs.copyFile(sourcePath, imagePath);

    return { imagePath, imageName };
  }

  async deleteIfExists(path: string): Promise<void> {
    await fs.rm(path, { force: true });
  }
}
