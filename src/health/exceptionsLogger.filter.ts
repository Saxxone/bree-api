import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
} from '@nestjs/common';
import { Request, Response } from 'express';
import * as fs from 'fs';

@Catch()
export class ExceptionsLoggerFilter implements ExceptionFilter {
  catch(exception: HttpException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    const status = exception.getStatus ? exception.getStatus() : 500;

    const logMessage = `
      --------------------------------------------------
      ${new Date().toISOString()}
      ${response.statusCode}
      
      ${request.method} ${request.url}
      ${JSON.stringify(this.sanitizeRequestBody(request.body))}
      ${exception.message}
      ${exception.stack}

      --------------------------------------------------
    `;

    fs.appendFile('./error.log', logMessage, (err) => {
      if (err) {
        console.error('Error writing to log file:', err);
      }
    });

    //format response object when exception is thrown
    response.status(status).json({
      status: status,
      message: exception.message,
    });
  }

  private sanitizeRequestBody(body: any): any {
    if (body && typeof body === 'object') {
      const sanitizedBody = { ...body };
      if (sanitizedBody.password) {
        sanitizedBody.password = '***REDACTED***';
      }
      return sanitizedBody;
    }
    return body;
  }
}
