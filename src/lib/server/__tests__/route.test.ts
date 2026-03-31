import { describe, it, expect, vi } from 'vitest';
import { routeHandler } from '../route';
import { z } from 'zod';
import { NextResponse } from 'next/server';

vi.mock('next/server', () => {
  return {
    NextResponse: {
      json: vi.fn((body, init) => ({ body, init })),
    },
  };
});

describe('routeHandler', () => {
  it('returns successful response', async () => {
    const handler = routeHandler(async () => {
      return { ok: true } as unknown as Response;
    });
    const result = await handler({} as Request, {});
    expect(result).toEqual({ ok: true });
  });

  it('catches and formats validation errors', async () => {
    const handler = routeHandler(async () => {
      z.string().parse(123);
      return {} as unknown as Response;
    });
    
    await handler({} as Request, {});
    expect(NextResponse.json).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'error',
        error: expect.objectContaining({ code: 'validation_error' })
      }),
      { status: 400 }
    );
  });
});
