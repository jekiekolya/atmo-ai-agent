// Each code has a catalog key errors.codes.<code>; HTTP statuses belong to the route layer.
export const ERROR_CODES = [
  "validation_failed",
  "unauthenticated",
  "forbidden_origin",
  "forbidden",
  "not_found",
  "email_in_use",
  "cannot_deactivate_super_admin",
  "invite_not_allowed",
  "invite_issued_concurrently",
  "no_outstanding_invite",
  "invite_invalid",
  "invite_used",
  "invite_expired",
  "account_locked",
] as const;

export type ErrorCode = (typeof ERROR_CODES)[number];

/** Field name → catalog keys, the shape Base UI's Form `errors` is built from. */
export type FieldErrors = Record<string, string[]>;

export abstract class DomainError extends Error {
  readonly code: ErrorCode;
  readonly detail: string | undefined;

  protected constructor(code: ErrorCode, detail?: string) {
    super(detail ? `${code}: ${detail}` : code);
    this.name = new.target.name;
    this.code = code;
    this.detail = detail;
  }
}

export class ValidationError extends DomainError {
  readonly fields: FieldErrors;

  constructor(fields: FieldErrors) {
    super("validation_failed");
    this.fields = fields;
  }
}

export class ForbiddenError extends DomainError {
  constructor() {
    super("forbidden");
  }
}

export class NotFoundError extends DomainError {
  constructor() {
    super("not_found");
  }
}

export class ConflictError extends DomainError {
  constructor(
    code: Extract<
      ErrorCode,
      | "email_in_use"
      | "cannot_deactivate_super_admin"
      | "invite_not_allowed"
      | "invite_issued_concurrently"
      | "no_outstanding_invite"
      | "invite_used"
    >,
    detail?: string,
  ) {
    super(code, detail);
  }
}

export class InvalidInviteError extends DomainError {
  constructor() {
    super("invite_invalid");
  }
}

export class GoneError extends DomainError {
  constructor(code: Extract<ErrorCode, "invite_expired">) {
    super(code);
  }
}

export class LockedError extends DomainError {
  constructor() {
    super("account_locked");
  }
}
