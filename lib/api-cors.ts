import { NextResponse } from "next/server";

export const API_CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
} as const;

export function jsonWithCors<T>(body: T, init?: ResponseInit) {
  return NextResponse.json(body, {
    ...init,
    headers: {
      ...API_CORS_HEADERS,
      ...(init?.headers ?? {}),
    },
  });
}

export function optionsWithCors() {
  return new NextResponse(null, {
    status: 204,
    headers: API_CORS_HEADERS,
  });
}
