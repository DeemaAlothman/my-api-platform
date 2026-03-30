import { Module } from '@nestjs/common';
import { DeductionPoliciesController } from './deduction-policies.controller';
import { DeductionPoliciesService } from './deduction-policies.service';
import { PrismaService } from '../prisma/prisma.service';

@Module({
  controllers: [DeductionPoliciesController],
  providers: [DeductionPoliciesService, PrismaService],
  exports: [DeductionPoliciesService],
})
export class DeductionPoliciesModule {}
