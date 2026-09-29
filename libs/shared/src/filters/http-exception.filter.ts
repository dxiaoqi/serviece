import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { ApiResponse } from '../response/api-response';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('ExceptionFilter');

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let httpStatus = HttpStatus.INTERNAL_SERVER_ERROR;
    let code = 50000;
    let message = '服务器内部错误';

    if (exception instanceof HttpException) {
      httpStatus = exception.getStatus();
      const res = exception.getResponse();
      if (typeof res === 'string') {
        message = res;
      } else if (res && typeof res === 'object') {
        const r = res as Record<string, unknown>;
        if (typeof r.message === 'string') {
          message = r.message;
        } else if (Array.isArray(r.message)) {
          message = (r.message as string[]).join('; ');
        }
        if (typeof r.code === 'number') {
          code = r.code;
        }
      }
      if (code === 50000) {
        code = httpStatus * 100;
      }
    } else if (exception instanceof Error) {
      message = exception.message;
      this.logger.error(exception.stack);
    }

    this.logger.error(
      `${request.method} ${request.url} -> ${httpStatus} ${message}`,
    );

    response.status(httpStatus).json(ApiResponse.error(code, message));
  }
}
