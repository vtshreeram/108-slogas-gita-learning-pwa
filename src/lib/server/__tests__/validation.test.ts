import { describe, it, expect, vi } from 'vitest';
import { z, ZodError } from 'zod';
import { parseJsonBody, withValidationError } from '../validation';
import { NextResponse } from 'next/server';

vi.mock('next/server', () => {
  return {
    NextResponse: {
      json: vi.fn((body, init) => ({ body, init })),
    },
  };
});

describe('validation utils', () => {
  describe('parseJsonBody', () => {
    it('parses valid body', async () => {
      const request = {
        json: async () => ({ name: 'Test', age: 25 })
      } as Request;
      const schema = z.object({
        name: z.string(),
        age: z.number()
      });
      
      const result = await parseJsonBody(request, schema);
      expect(result).toEqual({ name: 'Test', age: 25 });
    });

    it('throws ZodError on invalid body', async () => {
      const request = {
        json: async () => ({ name: 'Test', age: '25' })
      } as Request;
      const schema = z.object({
        name: z.string(),
        age: z.number()
      });
      
      await expect(parseJsonBody(request, schema)).rejects.toThrow(ZodError);
    });
  });

  describe('withValidationError', () => {
    it('handles ZodError', () => {
      const schema = z.string();
      const result = schema.safeParse(123);
      if (!result.success) {
        withValidationError(result.error);
        expect(NextResponse.json).toHaveBeenCalledWith(
          expect.objectContaining({
            status: 'error',
            error: expect.objectContaining({ code: 'validation_error' })
          }),
          { status: 400 }
        );
      }
    });

    it('handles internal error', () => {
      withValidationError(new Error('Something bad'));
      expect(NextResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'error',
          error: expect.objectContaining({ code: 'internal_error' })
        }),
        { status: 500 }
      );
    });
  });
});
