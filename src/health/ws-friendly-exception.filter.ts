import { Catch, IntrinsicException, Logger } from '@nestjs/common';
import { BaseWsExceptionFilter } from '@nestjs/websockets';
import { resolveClientException } from './client-error-resolution';

/**
 * Maps HTTP-layer and database errors from gateway handlers into Socket.IO
 * `exception` events shaped like `{ status: 'error', message, code?, cause?, detail? }`.
 */
@Catch()
export class FriendlyWsExceptionFilter extends BaseWsExceptionFilter {
  private static readonly log = new Logger(FriendlyWsExceptionFilter.name);

  constructor() {
    super({ includeCause: true });
  }

  handleUnknownError(exception: unknown, client: any, cause: unknown): void {
    const isProd = process.env.NODE_ENV === 'production';
    const resolved = resolveClientException(exception, isProd);
    const c = cause as { pattern?: string; data?: unknown } | undefined;

    const payload: Record<string, unknown> = {
      status: 'error',
      message: resolved.clientMessage,
      code: resolved.code,
    };
    if (!isProd && resolved.devHint) {
      payload.detail = resolved.devHint;
    }
    if (this.options?.includeCause && c && typeof c.pattern === 'string') {
      payload.cause = this.options.causeFactory(c.pattern, c.data);
    }

    client.emit('exception', payload);

    if (!(exception instanceof IntrinsicException)) {
      FriendlyWsExceptionFilter.log.error(exception);
    }
  }
}
