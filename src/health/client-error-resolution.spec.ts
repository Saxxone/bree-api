import { BadRequestException, ConflictException } from '@nestjs/common';
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
});
