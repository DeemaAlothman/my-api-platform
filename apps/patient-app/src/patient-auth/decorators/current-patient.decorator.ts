import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export interface CurrentPatient {
  patientAccountId: string;
  erpPatientId: string;
}

export const CurrentPatient = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): CurrentPatient => {
    const request = ctx.switchToHttp().getRequest();
    return request.user;
  },
);
