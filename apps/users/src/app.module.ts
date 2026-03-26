import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { JwtModule } from '@nestjs/jwt';
import { PrismaService } from './prisma/prisma.service';
import { UsersModule } from './users/users.module';
import { EmployeesModule } from './employees/employees.module';
import { DepartmentsModule } from './departments/departments.module';
import { RolesModule } from './roles/roles.module';
import { JobTitlesModule } from './job-titles/job-titles.module';
import { JobGradesModule } from './job-grades/job-grades.module';
import { CustodiesModule } from './custodies/custodies.module';
import { JwtStrategy } from './common/strategies/jwt.strategy';

@Module({
  imports: [
    PassportModule,
    JwtModule.register({
      secret: process.env.JWT_ACCESS_SECRET!,
      signOptions: { expiresIn: '15m' },
    }),
    UsersModule,
    EmployeesModule,
    DepartmentsModule,
    RolesModule,
    JobTitlesModule,
    JobGradesModule,
    CustodiesModule,
  ],
  providers: [PrismaService, JwtStrategy],
})
export class AppModule {}
