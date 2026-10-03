import type { z } from "zod";

import {
  ConflictError,
  type DomainError,
  ForbiddenError,
  GoneError,
  InvalidInviteError,
  LockedError,
  NotFoundError,
  ValidationError,
} from "@/server/errors";

// The one place a domain error becomes an HTTP status.
function statusOf(error: DomainError): number {
  if (error instanceof ValidationError) return 400;
  if (error instanceof ForbiddenError) return 403;
  if (error instanceof NotFoundError) return 404;
  if (error instanceof InvalidInviteError) return 404;
  if (error instanceof ConflictError) return 409;
  if (error instanceof GoneError) return 410;
  if (error instanceof LockedError) return 423;
  return 500;
}

const bareStatus = { unauthenticated: 401, forbidden_origin: 403 } as const;

export function errorResponse(
  error: DomainError | keyof typeof bareStatus,
): Response {
  if (typeof error === "string") {
    return Response.json(
      { error: { code: error } },
      { status: bareStatus[error] },
    );
  }

  return Response.json(
    {
      error: {
        code: error.code,
        ...(error.detail !== undefined && { detail: error.detail }),
        ...(error instanceof ValidationError && { fields: error.fields }),
      },
    },
    { status: statusOf(error) },
  );
}

export function fromZodError(error: z.ZodError): ValidationError {
  const fields: Record<string, string[]> = {};

  for (const issue of error.issues) {
    const name = issue.path.length > 0 ? String(issue.path[0]) : "_form";
    (fields[name] ??= []).push(issue.message);
  }

  return new ValidationError(fields);
}

export function ok(body: unknown): Response {
  return Response.json(body, { status: 200 });
}

export function created(body: unknown): Response {
  return Response.json(body, { status: 201 });
}

export function noContent(): Response {
  return new Response(null, { status: 204 });
}
