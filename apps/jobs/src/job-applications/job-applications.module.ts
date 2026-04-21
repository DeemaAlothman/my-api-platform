import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { JobApplicationsController } from './job-applications.controller';
import { JobApplicationsService } from './job-applications.service';
import { MailService } from '../infrastructure/mail.service';

@Module({
  imports: [HttpModule],
  controllers: [JobApplicationsController],
  providers: [JobApplicationsService, MailService],
})
export class JobApplicationsModule {}
