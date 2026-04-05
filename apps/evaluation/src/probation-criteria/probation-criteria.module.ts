import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule } from '@nestjs/config';
import { ProbationCriteriaController } from './probation-criteria.controller';
import { ProbationCriteriaService } from './probation-criteria.service';

@Module({
  imports: [JwtModule, ConfigModule],
  controllers: [ProbationCriteriaController],
  providers: [ProbationCriteriaService],
  exports: [ProbationCriteriaService],
})
export class ProbationCriteriaModule {}
