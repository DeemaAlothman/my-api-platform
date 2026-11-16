import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AppraisalHrController, AppraisalMeController } from './appraisal.controller';
import { AppraisalService } from './appraisal.service';
import { AppraisalDataService } from './appraisal-data.service';

@Module({
  imports: [PrismaModule],
  controllers: [AppraisalMeController, AppraisalHrController],
  providers: [AppraisalService, AppraisalDataService],
})
export class AppraisalModule {}
