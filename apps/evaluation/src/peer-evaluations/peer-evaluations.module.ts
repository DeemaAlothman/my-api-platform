import { Module } from '@nestjs/common';
import { PeerEvaluationsController } from './peer-evaluations.controller';
import { PeerEvaluationsService } from './peer-evaluations.service';

@Module({
  imports: [],
  controllers: [PeerEvaluationsController],
  providers: [PeerEvaluationsService],
  exports: [PeerEvaluationsService],
})
export class PeerEvaluationsModule {}
