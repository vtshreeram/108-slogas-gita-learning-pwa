import { NextResponse } from "next/server";

export type ApiStatus = "ok" | "error";

export type ApiEnvelope<T> = {
  status: ApiStatus;
  data: T;
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
