import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { JwtModule } from '@nestjs/jwt';
import { PrismaService } from './prisma/prisma.service';
import { RequestsModule } from './requests/requests.module';
import { JwtStrategy } from './common/strategies/jwt.strategy';

@Module({
  imports: [
    PassportModule,
    JwtModule.register({
      secret: process.env.JWT_ACCESS_SECRET || 'dev_access_secret_change_me',
      signOptions: { expiresIn: '15m' },
    }),
    RequestsModule,
  ],
  providers: [PrismaService, JwtStrategy],
})
export class AppModule {}
