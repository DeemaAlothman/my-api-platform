import { Module } from '@nestjs/common';
import { RolesController, PermissionsController } from './roles.controller';
import { RolesService } from './roles.service';
import { PrismaService } from '../prisma/prisma.service';

@Module({
  controllers: [RolesController, PermissionsController],
  providers: [RolesService, PrismaService],
  exports: [RolesService],
})
export class RolesModule {}
