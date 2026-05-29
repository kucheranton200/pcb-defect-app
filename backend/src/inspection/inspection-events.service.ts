import { Injectable, MessageEvent } from '@nestjs/common';
import { Observable, Subject } from 'rxjs';
import { Defect } from '@prisma/client';
import { ModelDetection } from '../defects/defects.service';

export interface InspectionFrameEvent {
  id: string;
  status: 'accepted' | 'rejected';
  imageBase64: string;
  detections: ModelDetection[];
  savedDefects: Defect[];
  createdAt: string;
}

@Injectable()
export class InspectionEventsService {
  private readonly stream = new Subject<MessageEvent>();

  events(): Observable<MessageEvent> {
    return this.stream.asObservable();
  }

  publish(frame: InspectionFrameEvent): void {
    this.stream.next({ data: frame });
  }
}
