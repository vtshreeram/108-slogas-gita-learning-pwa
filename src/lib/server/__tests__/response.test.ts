import { describe, it, expect, vi } from 'vitest';
import { z } from 'zod';
import { fromZodError, jsonOk, jsonError } from '../response';
import { NextResponse } from 'next/server';

vi.mock('next/server', () => {
  return {
    NextResponse: {
      json: vi.fn((body, init) => ({ body, init })),
    },
  };
});

describe('response utils', () => {
  describe('fromZodError', () => {
    it('converts ZodError to ApiErrorDetail', () => {
      const schema = z.object({
        name: z.string().min(3),
        age: z.number(),
      });

      const result = schema.safeParse({ name: 'ab', age: 'twenty' });
      expect(result.success).toBe(false);

      if (!result.success) {
        const detail = fromZodError(result.error);
        expect(detail.code).toBe('validation_error');
        expect(detail.issues).toHaveLength(2);
        expect(detail.issues).toEqual(
          expect.arrayContaining([
            expect.objectContaining({ path: 'name' }),
            expect.objectContaining({ path: 'age' }),
          ])
        );
      }
    });
  });

  describe('jsonOk', () => {
    it('wraps data in envelope', () => {
      const response = jsonOk({ id: 1 }, { status: 201 });
      
      expect(NextResponse.json).toHaveBeenCalledWith(
        { status: 'ok', data: { id: 1 } },
        { status: 201 }
      );
    });
  });

  describe('jsonError', () => {
    it('wraps error in envelope', () => {
      const error = { code: 'bad_request' as const, message: 'Invalid format' };
      const response = jsonError(error, { status: 400 });
      
      expect(NextResponse.json).toHaveBeenCalledWith(
        { status: 'error', error },
        { status: 400 }
      );
    });
  });
});
