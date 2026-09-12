import { Injectable, ExecutionContext } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class PatientJwtAuthGuard extends AuthGuard('patient-jwt') {
  canActivate(context: ExecutionContext) {
    return super.canActivate(context);
  }
}
