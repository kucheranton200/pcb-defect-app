import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import FormData from 'form-data';
import { createReadStream } from 'fs';
import { ModelDetection } from '../defects/defects.service';

interface MlPredictResponse {
  detections: ModelDetection[];
}

@Injectable()
export class MlClientService {
  constructor(private readonly config: ConfigService) {}

  async predict(imagePath: string): Promise<ModelDetection[]> {
    const mlServiceUrl = this.config.get<string>(
      'ML_SERVICE_URL',
      'http://localhost:8000',
    );

    const form = new FormData();
    form.append('file', createReadStream(imagePath));

    const response = await axios.post<MlPredictResponse>(
      `${mlServiceUrl}/predict`,
      form,
      {
        headers: form.getHeaders(),
        timeout: 60_000,
      },
    );

    return response.data.detections ?? [];
  }
}
