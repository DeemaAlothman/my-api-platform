import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import type { Response, Request } from 'express';
import { Prisma } from '@prisma/client';

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let code = 'INTERNAL_ERROR';
    let message = 'An unexpected error occurred';
    let details: any[] = [];

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();

      if (typeof exceptionResponse === 'object' && exceptionResponse !== null) {
        code = (exceptionResponse as any).code || code;
        message = (exceptionResponse as any).message || message;
        details = (exceptionResponse as any).details || [];
      } else if (typeof exceptionResponse === 'string') {
        message = exceptionResponse;
      }
    } else if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      status = HttpStatus.BAD_REQUEST;
      code = `PRISMA_${exception.code}`;
      if (exception.code === 'P2002') {
        const fields = (exception.meta?.target as string[]) ?? [];
        code = 'RESOURCE_ALREADY_EXISTS';
        message = `Unique constraint violation on field(s): ${fields.join(', ')}`;
        details = fields.map((f) => ({ field: f }));
      } else if (exception.code === 'P2003') {
        const field = (exception.meta?.field_name as string) ?? '';
        code = 'FOREIGN_KEY_VIOLATION';
        message = `Foreign key constraint failed on field: ${field}`;
        details = [{ field }];
      } else if (exception.code === 'P2025') {
        status = HttpStatus.NOT_FOUND;
        code = 'RESOURCE_NOT_FOUND';
        message = (exception.meta?.cause as string) ?? 'Record not found';
      } else {
        message = exception.message;
      }
    } else if (exception instanceof Prisma.PrismaClientValidationError) {
      status = HttpStatus.BAD_REQUEST;
      code = 'VALIDATION_ERROR';
      message =
        exception.message.split('\n').filter(Boolean).pop() ??
        'Validation error';
    } else if (exception instanceof Error) {
      message = exception.message;
    }

    response.status(status).json({
      success: false,
      error: {
        code,
        message,
        details,
      },
      meta: {
        timestamp: new Date().toISOString(),
        path: request.url,
        requestId: request.headers['x-request-id'],
      },
    });
  }
}
