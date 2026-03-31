import { ZodError } from "zod";
import { NextResponse } from "next/server";

export type ApiStatus = "ok" | "error";

export type ApiEnvelope<T> = {
  status: ApiStatus;
  data: T;
};

export type ApiErrorCode =
  | "bad_request"
  | "validation_error"
  | "internal_error";

export type ApiErrorDetail = {
  code: ApiErrorCode;
  message: string;
  issues?: {
    path: string;
    message: string;
  }[];
};

export type ApiErrorEnvelope = {
  status: "error";
  error: ApiErrorDetail;
};

export function jsonOk<T>(data: T, init?: ResponseInit) {
  return NextResponse.json<ApiEnvelope<T>>(
    {
      status: "ok",
      data,
    },
    init,
  );
}

export function jsonError(error: ApiErrorDetail, init?: ResponseInit) {
  return NextResponse.json<ApiErrorEnvelope>(
    {
      status: "error",
      error,
    },
    init,
  );
}

export function fromZodError(error: ZodError): ApiErrorDetail {
  return {
    code: "validation_error",
    message: "Request validation failed.",
    issues: error.issues.map((issue) => ({
      path: issue.path.length > 0 ? issue.path.join(".") : "root",
      message: issue.message,
    })),
  };
}
