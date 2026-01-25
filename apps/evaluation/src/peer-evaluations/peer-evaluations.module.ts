import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule } from '@nestjs/config';
import { PeerEvaluationsController } from './peer-evaluations.controller';
import { PeerEvaluationsService } from './peer-evaluations.service';

@Module({
  imports: [JwtModule, ConfigModule],
  controllers: [PeerEvaluationsController],
  providers: [PeerEvaluationsService],
  exports: [PeerEvaluationsService],
})
export class PeerEvaluationsModule {}
