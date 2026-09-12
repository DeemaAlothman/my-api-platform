import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PrismaService } from '../../prisma/prisma.service';

interface PatientJwtPayload {
  sub: string; // PatientAccount.id
  erpPatientId: string;
  iat?: number;
  exp?: number;
}

// استراتيجية JWT منفصلة تماماً عن نظام موظفي المنصة (@shared/auth) — سر مختلف وحمولة مختلفة،
// لأن حساب المريض ليس User/Employee ولا يحمل صلاحيات RBAC.
@Injectable()
export class PatientJwtStrategy extends PassportStrategy(Strategy, 'patient-jwt') {
  constructor(private readonly prisma: PrismaService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: process.env.PATIENT_JWT_ACCESS_SECRET!,
    });
  }

  async validate(payload: PatientJwtPayload) {
    if (!payload.sub) throw new UnauthorizedException('Invalid token payload');

    const account = await this.prisma.patientAccount.findFirst({
      where: { id: payload.sub, deletedAt: null },
      select: { id: true, erpPatientId: true, status: true },
    });
    if (!account || account.status !== 'ACTIVE') {
      throw new UnauthorizedException({ code: 'PATIENT_ACCOUNT_INACTIVE', message: 'Account not active' });
    }

    return { patientAccountId: account.id, erpPatientId: account.erpPatientId };
  }
}
