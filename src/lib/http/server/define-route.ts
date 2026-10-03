import type { z } from "zod";

import { getSessionUser, type SessionUser } from "@/auth/dal";
import { errorResponse, fromZodError } from "@/lib/http/server/route-response";
import { isSameOrigin } from "@/lib/http/server/same-origin";
import { DomainError, ValidationError } from "@/server/errors";

type Params = Record<string, string | string[]>;

type HandlerInput<Body, Actor> = { body: Body; actor: Actor; params: Params };

type RouteOptions<Schema extends z.ZodType | undefined, Actor> = {
  schema?: Schema;
  handler: (
    input: HandlerInput<
      Schema extends z.ZodType ? z.infer<Schema> : undefined,
      Actor
    >,
  ) => Promise<Response>;
};

type RouteHandler = (
  request: Request,
  context: { params: Promise<Params> },
) => Promise<Response>;

const SAFE_METHODS = new Set(["GET", "HEAD"]);

async function readBody(request: Request): Promise<unknown> {
  const text = await request.text();
  return text === "" ? undefined : JSON.parse(text);
}

/** Roles are not checked here: the service authorizes the actor (MC-007). */
export function defineRoute<Schema extends z.ZodType | undefined = undefined>(
  options: RouteOptions<Schema, SessionUser> & { session: "required" },
): RouteHandler;
export function defineRoute<Schema extends z.ZodType | undefined = undefined>(
  options: RouteOptions<Schema, null> & { session: "none" },
): RouteHandler;
export function defineRoute(options: {
  schema?: z.ZodType;
  session: "required" | "none";
  // Only the overloads are typed; the checks above produce whatever this receives.
  handler: (input: HandlerInput<never, never>) => Promise<Response>;
}): RouteHandler {
  return async (request, context) => {
    try {
      if (!SAFE_METHODS.has(request.method) && !isSameOrigin(request)) {
        return errorResponse("forbidden_origin");
      }

      let body: unknown = undefined;
      if (options.schema) {
        let raw: unknown;
        try {
          raw = await readBody(request);
        } catch {
          return errorResponse(
            new ValidationError({ _form: ["validation.body.unparseable"] }),
          );
        }
        const parsed = options.schema.safeParse(raw ?? {});
        if (!parsed.success) return errorResponse(fromZodError(parsed.error));
        body = parsed.data;
      }

      let actor: SessionUser | null = null;
      if (options.session === "required") {
        actor = await getSessionUser();
        if (!actor) return errorResponse("unauthenticated");
      }

      const handler = options.handler as (
        input: HandlerInput<unknown, SessionUser | null>,
      ) => Promise<Response>;
      return await handler({
        body,
        actor,
        params: await context.params,
      });
    } catch (error) {
      if (error instanceof DomainError) return errorResponse(error);

      // Ordinary crash logging, not the security-event log the spec rules out.
      console.error(error);
      return new Response(null, { status: 500 });
    }
  };
}
