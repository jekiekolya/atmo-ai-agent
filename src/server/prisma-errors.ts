import { Prisma } from "@generated/client";

// Under @prisma/adapter-pg a P2002 has no meta.target; the constraint is in the adapter error.
export function isUniqueViolation(error: unknown, constraint: string): boolean {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError)) return false;
  if (error.code !== "P2002") return false;

  const adapterError = error.meta?.driverAdapterError as
    { cause?: { constraint?: { index?: string } } } | undefined;

  return adapterError?.cause?.constraint?.index === constraint;
}
