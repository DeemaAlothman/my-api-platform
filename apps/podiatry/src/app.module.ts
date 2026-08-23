import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { JwtModule } from '@nestjs/jwt';
import { PrismaService } from './prisma/prisma.service';
import { ReceptionsModule } from './receptions/receptions.module';
import { SessionsModule } from './sessions/sessions.module';
import { ReviewsModule } from './reviews/reviews.module';
import { DoctorDecisionsModule } from './doctor-decisions/doctor-decisions.module';
import { JwtStrategy, PRISMA_FOR_JWT } from '@shared/auth';

@Module({
  imports: [
    PassportModule,
    JwtModule.register({
      secret: process.env.JWT_ACCESS_SECRET!,
      signOptions: { expiresIn: '15m' },
    }),
    ReceptionsModule,
    SessionsModule,
    ReviewsModule,
    DoctorDecisionsModule,
  ],
  providers: [
    PrismaService,
    JwtStrategy,
    { provide: PRISMA_FOR_JWT, useExisting: PrismaService },
  ],
})
export class AppModule {}
