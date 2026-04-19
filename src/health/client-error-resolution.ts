import { HttpException, HttpStatus } from '@nestjs/common';
import { Prisma } from '@prisma/client';

export type ClientErrorCode =
  | 'BAD_REQUEST'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'UNPROCESSABLE_ENTITY'
  | 'TOO_MANY_REQUESTS'
  | 'SERVICE_UNAVAILABLE'
  | 'INTERNAL_ERROR'
  | 'VALIDATION_ERROR'
  | 'PRISMA_DUPLICATE'
  | 'PRISMA_NOT_FOUND'
  | 'PRISMA_INVALID_REFERENCE'
  | 'PRISMA_RELATION_VIOLATION'
  | 'PRISMA_VALUE_TOO_LONG'
  | 'PRISMA_REQUIRED_FIELD'
  | 'PRISMA_TRANSACTION_CONFLICT'
  | 'PRISMA_TIMEOUT'
  | 'PRISMA_MISSING_VALUE'
  | 'PRISMA_RELATED_NOT_FOUND'
  | 'PRISMA_RAW_QUERY_FAILED'
  | 'PRISMA_UNKNOWN'
  | 'INSUFFICIENT_COINS'
  | 'WALLET_BUSY';

export interface ResolvedClientError {
  status: number;
  clientMessage: string;
  logDetail: string;
  devHint?: string;
  code: ClientErrorCode;
}

function statusToCode(status: number): ClientErrorCode {
  switch (status) {
    case HttpStatus.BAD_REQUEST:
      return 'BAD_REQUEST';
    case HttpStatus.UNAUTHORIZED:
      return 'UNAUTHORIZED';
    case HttpStatus.FORBIDDEN:
      return 'FORBIDDEN';
    case HttpStatus.NOT_FOUND:
      return 'NOT_FOUND';
    case HttpStatus.CONFLICT:
      return 'CONFLICT';
    case HttpStatus.UNPROCESSABLE_ENTITY:
      return 'UNPROCESSABLE_ENTITY';
    case HttpStatus.TOO_MANY_REQUESTS:
      return 'TOO_MANY_REQUESTS';
    case HttpStatus.SERVICE_UNAVAILABLE:
      return 'SERVICE_UNAVAILABLE';
    default:
      if (status >= 500) {
        return 'INTERNAL_ERROR';
      }
      return 'BAD_REQUEST';
  }
}

function httpExceptionRefinementCode(
  exception: HttpException,
  clientMessage: string,
): ClientErrorCode | undefined {
  const msg = clientMessage.toLowerCase();
  if (msg.includes('insufficient coin')) {
    return 'INSUFFICIENT_COINS';
  }
  if (msg.includes('wallet busy')) {
    return 'WALLET_BUSY';
  }
  const body = exception.getResponse();
  if (
    typeof body === 'object' &&
    body !== null &&
    Array.isArray((body as Record<string, unknown>)['message'])
  ) {
    return 'VALIDATION_ERROR';
  }
  return undefined;
}

export function resolveClientException(
  exception: unknown,
  isProd: boolean,
): ResolvedClientError {
  if (exception instanceof HttpException) {
    const status = exception.getStatus();
    let clientMessage = clientMessageFromHttpException(exception);
    clientMessage = applyDefaultStatusPhrasing(status, clientMessage);
    const refined = httpExceptionRefinementCode(exception, clientMessage);
    return {
      status,
      clientMessage,
      logDetail: `${exception.name}: ${exception.message}\n${exception.stack ?? ''}`,
      code: refined ?? statusToCode(status),
    };
  }

  if (exception instanceof Prisma.PrismaClientKnownRequestError) {
    const clientCode = prismaCodeToClientCode(exception.code);
    const metaSummary =
      exception.meta && Object.keys(exception.meta).length > 0
        ? ` ${JSON.stringify(exception.meta)}`
        : '';
    return {
      status: httpStatusForPrisma(exception.code),
      clientMessage: friendlyPrismaMessage(exception),
      logDetail: `${exception.code}: ${exception.message}${metaSummary}\n${exception.stack ?? ''}`,
      devHint:
        isProd || clientCode !== 'PRISMA_UNKNOWN'
          ? undefined
          : `${exception.code}: ${exception.message}${metaSummary}`,
      code: clientCode,
    };
  }

  if (exception instanceof Prisma.PrismaClientValidationError) {
    return {
      status: HttpStatus.BAD_REQUEST,
      clientMessage:
        'The request could not be processed. Please check your input and try again.',
      logDetail: exception.message,
      devHint: isProd ? undefined : exception.message,
      code: 'VALIDATION_ERROR',
    };
  }

  if (exception instanceof Error) {
    return {
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      clientMessage: isProd
        ? 'Something went wrong on our side. Please try again in a moment.'
        : exception.message,
      logDetail: `${exception.name}: ${exception.message}\n${exception.stack ?? ''}`,
      devHint: isProd ? undefined : exception.message,
      code: 'INTERNAL_ERROR',
    };
  }

  return {
    status: HttpStatus.INTERNAL_SERVER_ERROR,
    clientMessage: isProd
      ? 'Something went wrong on our side. Please try again in a moment.'
      : 'An unexpected error occurred.',
    logDetail: String(exception),
    code: 'INTERNAL_ERROR',
  };
}

function prismaCodeToClientCode(code: string): ClientErrorCode {
  switch (code) {
    case 'P2002':
      return 'PRISMA_DUPLICATE';
    case 'P2025':
      return 'PRISMA_NOT_FOUND';
    case 'P2003':
      return 'PRISMA_INVALID_REFERENCE';
    case 'P2014':
      return 'PRISMA_RELATION_VIOLATION';
    case 'P2000':
      return 'PRISMA_VALUE_TOO_LONG';
    case 'P2011':
      return 'PRISMA_REQUIRED_FIELD';
    case 'P2034':
      return 'PRISMA_TRANSACTION_CONFLICT';
    case 'P2024':
      return 'PRISMA_TIMEOUT';
    case 'P2012':
      return 'PRISMA_MISSING_VALUE';
    case 'P2015':
      return 'PRISMA_RELATED_NOT_FOUND';
    case 'P2010':
      return 'PRISMA_RAW_QUERY_FAILED';
    default:
      return 'PRISMA_UNKNOWN';
  }
}

function clientMessageFromHttpException(exception: HttpException): string {
  const body = exception.getResponse();
  const fromBody = coerceBodyToMessage(body);
  if (fromBody) {
    return humanizeAuthFailure(exception.getStatus(), fromBody);
  }
  if (exception.message) {
    return humanizeAuthFailure(exception.getStatus(), exception.message);
  }
  return '';
}

function applyDefaultStatusPhrasing(status: number, message: string): string {
  const trimmed = message?.trim();
  if (trimmed) {
    return trimmed;
  }
  if (status === HttpStatus.UNAUTHORIZED) {
    return 'Please sign in to continue.';
  }
  if (status === HttpStatus.FORBIDDEN) {
    return "You don't have permission to do that.";
  }
  if (status === HttpStatus.NOT_FOUND) {
    return 'The requested resource was not found.';
  }
  if (status === HttpStatus.TOO_MANY_REQUESTS) {
    return 'Too many requests. Please wait a moment and try again.';
  }
  return 'Something went wrong.';
}

function humanizeAuthFailure(status: number, message: string): string {
  if (status !== HttpStatus.UNAUTHORIZED) {
    return message;
  }
  const m = message.trim().toLowerCase();
  const map: Record<string, string> = {
    unauthorized: 'Please sign in to continue.',
    'jwt expired': 'Your session has expired. Please sign in again.',
    'invalid token': 'Invalid or expired session. Please sign in again.',
    'invalid signature': 'Invalid or expired session. Please sign in again.',
  };
  if (map[m]) {
    return map[m];
  }
  if (m.startsWith('jwt ') || m.includes('jsonwebtoken')) {
    return 'Your session is invalid or has expired. Please sign in again.';
  }
  return message;
}

function coerceBodyToMessage(body: string | object): string {
  if (typeof body === 'string') {
    return body;
  }
  if (body instanceof Error) {
    return body.message;
  }
  if (typeof body === 'object' && body !== null) {
    const b = body as Record<string, unknown>;
    const msg = b['message'];
    if (typeof msg === 'string') {
      return msg;
    }
    if (Array.isArray(msg)) {
      return msg
        .map((x) => (typeof x === 'string' ? x : String(x)))
        .filter(Boolean)
        .join(' ');
    }
    if (typeof b['error'] === 'string') {
      return b['error'];
    }
  }
  return '';
}

function httpStatusForPrisma(code: string): number {
  switch (code) {
    case 'P2002':
    case 'P2034':
      return HttpStatus.CONFLICT;
    case 'P2025':
    case 'P2015':
      return HttpStatus.NOT_FOUND;
    case 'P2003':
    case 'P2014':
    case 'P2012':
      return HttpStatus.BAD_REQUEST;
    case 'P2024':
      return HttpStatus.SERVICE_UNAVAILABLE;
    default:
      return HttpStatus.INTERNAL_SERVER_ERROR;
  }
}

function friendlyPrismaMessage(
  err: Prisma.PrismaClientKnownRequestError,
): string {
  switch (err.code) {
    case 'P2002':
      return 'That value is already in use. Please choose a different one.';
    case 'P2025':
      return 'The item you requested could not be found.';
    case 'P2003':
      return 'This action references data that is missing or invalid.';
    case 'P2014':
      return 'This change would break a required link between records.';
    case 'P2000':
      return 'One of the values provided is too long.';
    case 'P2011':
      return 'A required field was missing.';
    case 'P2034':
      return 'That action conflicted with another update. Please try again.';
    case 'P2024':
      return 'The database is busy right now. Please try again in a moment.';
    case 'P2012':
      return 'Required information was missing from the request.';
    case 'P2015':
      return 'A related record could not be found.';
    case 'P2010':
      return 'We could not complete that action. Please try again.';
    default:
      return 'We could not complete that action. Please try again.';
  }
}
