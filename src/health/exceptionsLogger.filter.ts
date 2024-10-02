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
      ${JSON.stringify(request.body)}
      ${exception.message}
      ${exception.stack}

      --------------------------------------------------
    `;

    fs.appendFile('error.log', logMessage, (err) => {
      if (err) {
        console.error('Error writing to log file:', err);
      }
    });

    response.status(status).json({
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request.url,
      message: exception.message,
    });
  }
}
