import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { spawn } from 'child_process';
import { randomUUID } from 'crypto';
import { promises as fs } from 'fs';
import { join } from 'path';
import { DefectsService } from '../defects/defects.service';
import { MlClientService } from './ml-client.service';

@Injectable()
export class InspectionService {
  constructor(
    private readonly config: ConfigService,
    private readonly defectsService: DefectsService,
    private readonly mlClient: MlClientService,
  ) {}

  async inspectVideoChunk(video: Express.Multer.File) {
    if (!video) {
      throw new BadRequestException('Video chunk is required');
    }

    const tempRoot = this.config.get<string>('TEMP_DIR', 'storage/tmp');
    const workDir = join(tempRoot, randomUUID());
    await fs.mkdir(workDir, { recursive: true });

    const videoPath = join(workDir, video.originalname || 'chunk.webm');
    await fs.writeFile(videoPath, video.buffer);

    try {
      const framePaths = await this.extractFrames(videoPath, workDir);
      const savedDefects = [];
      let analyzedFrames = 0;

      for (const framePath of framePaths) {
        analyzedFrames += 1;
        const detections = await this.mlClient.predict(framePath);

        if (detections.length === 0) {
          await fs.rm(framePath, { force: true });
          continue;
        }

        for (const detection of detections) {
          savedDefects.push(
            await this.defectsService.createFromDetection(framePath, detection),
          );
        }
      }

      return {
        analyzedFrames,
        savedDefectsCount: savedDefects.length,
        savedDefects,
      };
    } finally {
      await fs.rm(workDir, { recursive: true, force: true });
    }
  }

  private async extractFrames(
    videoPath: string,
    workDir: string,
  ): Promise<string[]> {
    const frameRate = this.config.get<number>('FRAME_RATE', 2);
    const outputPattern = join(workDir, 'frame-%06d.jpg');

    await new Promise<void>((resolve, reject) => {
      const ffmpeg = spawn('ffmpeg', [
        '-hide_banner',
        '-loglevel',
        'error',
        '-i',
        videoPath,
        '-vf',
        `fps=${frameRate}`,
        '-q:v',
        '2',
        outputPattern,
      ]);

      let stderr = '';
      ffmpeg.stderr.on('data', (chunk) => {
        stderr += chunk.toString();
      });
      ffmpeg.on('error', reject);
      ffmpeg.on('close', (code) => {
        if (code === 0) {
          resolve();
          return;
        }

        reject(new Error(stderr || `ffmpeg exited with code ${code}`));
      });
    });

    const files = await fs.readdir(workDir);
    return files
      .filter((file) => file.startsWith('frame-') && file.endsWith('.jpg'))
      .sort()
      .map((file) => join(workDir, file));
  }
}
