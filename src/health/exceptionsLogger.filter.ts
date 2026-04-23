import { ExceptionFilter, Catch, ArgumentsHost } from '@nestjs/common';
import { Request, Response } from 'express';
import * as fs from 'fs';
import { resolveClientException } from './client-error-resolution';

@Catch()
export class ExceptionsLoggerFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    const isProd = process.env.NODE_ENV === 'production';

    const resolved = resolveClientException(exception, isProd);

    const logMessage = `
      --------------------------------------------------
      ${new Date().toISOString()}
      ${resolved.status}

      ${request.method} ${request.url}
      ${JSON.stringify(this.sanitizeRequestBody(request.body))}
      ${resolved.logDetail}

      --------------------------------------------------
    `;

    fs.appendFile('./error.log', logMessage, (err) => {
      if (err) {
        console.error('Error writing to log file:', err);
      }
    });

    const payload: Record<string, unknown> = {
      status: resolved.status,
      message: resolved.clientMessage,
      code: resolved.code,
    };
    if (!isProd && resolved.devHint) {
      payload.detail = resolved.devHint;
    }

    response.status(resolved.status).json(payload);
  }

  private static readonly sensitiveBodyKeys = new Set([
    'password',
    'token',
    'access_token',
    'refresh_token',
    'id_token',
    'e2eePrivateKeyBackupCiphertext',
  ]);

  private sanitizeRequestBody(body: unknown): unknown {
    if (body && typeof body === 'object') {
      const sanitizedBody = { ...(body as Record<string, unknown>) };
      for (const k of Object.keys(sanitizedBody)) {
        if (ExceptionsLoggerFilter.sensitiveBodyKeys.has(k)) {
          sanitizedBody[k] = '***REDACTED***';
        }
      }
      return sanitizedBody;
    }
    return body;
  }
}
