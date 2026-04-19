import { BadRequestException, ConflictException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { resolveClientException } from './client-error-resolution';

describe('resolveClientException', () => {
  it('tags class-validator-style bodies as VALIDATION_ERROR', () => {
    const ex = new BadRequestException({
      message: ['email must be an email', 'name should not be empty'],
      error: 'Bad Request',
      statusCode: 400,
    });
    const r = resolveClientException(ex, false);
    expect(r.code).toBe('VALIDATION_ERROR');
    expect(r.clientMessage).toContain('email must be an email');
    expect(r.status).toBe(400);
  });

  it('maps insufficient coins ConflictException', () => {
    const ex = new ConflictException('Insufficient coin balance');
    const r = resolveClientException(ex, true);
    expect(r.code).toBe('INSUFFICIENT_COINS');
    expect(r.clientMessage).toContain('Insufficient coin balance');
  });

  it('hides generic Error internals in production', () => {
    const r = resolveClientException(new Error('DB blew up'), true);
    expect(r.clientMessage).not.toContain('DB blew up');
    expect(r.code).toBe('INTERNAL_ERROR');
  });

  it('maps Prisma transaction write conflict P2034', () => {
    const ex = new Prisma.PrismaClientKnownRequestError('conflict', {
      code: 'P2034',
      clientVersion: '0.0.0',
    });
    const r = resolveClientException(ex, true);
    expect(r.code).toBe('PRISMA_TRANSACTION_CONFLICT');
    expect(r.status).toBe(409);
    expect(r.clientMessage).toContain('conflicted');
  });

  it('includes devHint for unmapped Prisma codes in development', () => {
    const ex = new Prisma.PrismaClientKnownRequestError('weird', {
      code: 'P2099',
      clientVersion: '0.0.0',
      meta: { foo: 'bar' },
    });
    const r = resolveClientException(ex, false);
    expect(r.code).toBe('PRISMA_UNKNOWN');
    expect(r.devHint).toContain('P2099');
    expect(r.devHint).toContain('foo');
  });
});
