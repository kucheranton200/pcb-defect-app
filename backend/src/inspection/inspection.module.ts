import { Module } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import { DefectsModule } from '../defects/defects.module';
import { InspectionController } from './inspection.controller';
import { InspectionService } from './inspection.service';
import { MlClientService } from './ml-client.service';

@Module({
  imports: [MulterModule, DefectsModule],
  controllers: [InspectionController],
  providers: [InspectionService, MlClientService],
})
export class InspectionModule {}
