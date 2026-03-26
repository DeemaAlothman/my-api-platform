import { Controller, Get, Post, Query, Req, Res } from '@nestjs/common';
import { Request, Response } from 'express';
import { IclockService } from './iclock.service';

/**
 * PUSH Protocol Endpoints - بدون JWT Auth
 * الجهاز يتواصل مباشرة مع هذه الإندبوينتات
 */
@Controller('iclock')
export class IclockController {
  constructor(private readonly iclockService: IclockService) {}

  /**
   * GET /iclock/cdata?SN=XXXX&options=all
   * Handshake - الجهاز يسجل نفسه ويطلب الإعدادات
   */
  @Get('cdata')
  async handshake(
    @Query('SN') sn: string,
    @Query('table') table: string,
    @Res() res: Response,
  ) {
    // إذا table موجود معناه طلب بيانات وليس handshake
    if (table) {
      res.status(200).send('OK');
      return;
    }

    const responseText = await this.iclockService.handleHandshake(sn || '');
    res.status(200).type('text/plain').send(responseText);
  }

  /**
   * POST /iclock/cdata?SN=XXXX&table=ATTLOG
   * استقبال سجلات الحضور
   */
  @Post('cdata')
  async receiveAttendance(
    @Query('SN') sn: string,
    @Query('table') table: string,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    if (table === 'ATTLOG') {
      // قراءة الـ body كـ text
      let body = '';
      if (typeof req.body === 'string') {
        body = req.body;
      } else if (Buffer.isBuffer(req.body)) {
        body = req.body.toString('utf8');
      } else if (req.body && typeof req.body === 'object') {
        body = JSON.stringify(req.body);
      }

      await this.iclockService.handleAttendanceLogs(sn || '', body);
    }

    res.status(200).type('text/plain').send('OK');
  }

  /**
   * GET /iclock/getrequest?SN=XXXX
   * الجهاز يسأل عن أوامر pending
   */
  @Get('getrequest')
  async getRequest(@Query('SN') sn: string, @Res() res: Response) {
    // لا توجد أوامر pending حالياً
    res.status(200).type('text/plain').send('OK');
  }

  /**
   * POST /iclock/devicecmd
   * رد الجهاز على أوامر
   */
  @Post('devicecmd')
  async deviceCmd(@Res() res: Response) {
    res.status(200).type('text/plain').send('OK');
  }
}
