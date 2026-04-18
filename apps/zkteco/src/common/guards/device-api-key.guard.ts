import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class DeviceApiKeyGuard implements CanActivate {
  constructor(private prisma: PrismaService) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest();
    const sn = req.query.SN as string;
    const apiKey =
      (req.headers['x-device-key'] as string) || (req.query.apiKey as string);

    if (!sn || !apiKey) {
      throw new UnauthorizedException({ code: 'DEVICE_AUTH_MISSING', message: 'SN and apiKey are required' });
    }

    const device = await this.prisma.biometricDevice.findUnique({
      where: { serialNumber: sn },
    });

    if (!device || !device.isActive || device.apiKey !== apiKey) {
      throw new UnauthorizedException({ code: 'DEVICE_AUTH_INVALID', message: 'Invalid or inactive device credentials' });
    }

    req.device = device;
    return true;
  }
}
