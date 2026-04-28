import { Controller, Post, Headers, Body, UnauthorizedException } from '@nestjs/common';
import { MailService } from './mail.service';

@Controller('mail')
export class MailInternalController {
  constructor(private readonly mailService: MailService) {}

  @Post('internal/system-send')
  systemSend(
    @Headers('x-internal-token') token: string,
    @Body() dto: { recipientUserId: string; subject: string; body: string },
  ) {
    if (!token || token !== process.env.INTERNAL_SERVICE_TOKEN) {
      throw new UnauthorizedException('Invalid internal token');
    }
    return this.mailService.systemSend(dto);
  }
}
