import { ExceptionFilter, Catch, ArgumentsHost, HttpException, HttpStatus } from '@nestjs/common';
import { Request, Response } from 'express';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Internal server error';
    let code = 'INTERNAL_SERVER_ERROR';
    let details: any = null;
    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const r = exception.getResponse() as any;
      if (typeof r === 'object') { message = r.message || exception.message; code = r.code || exception.name; details = r.details || null; }
      else { message = r as string; }
    } else if (exception instanceof Error) { message = exception.message; }
    response.status(status).json({ success: false, code, message, details, timestamp: new Date().toISOString(), path: request.url });
  }
}
