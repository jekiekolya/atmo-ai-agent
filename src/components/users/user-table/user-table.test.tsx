import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string, values?: Record<string, unknown>) => {
    if (key === "common.fullName") {
      return `${values?.firstName} ${values?.lastName}`;
    }
    if (key === "users.list.pendingUntil") {
      return `pending until ${values?.expiresAt}`;
    }
    return key;
  },
}));
vi.mock("@/i18n/use-format-instant", () => ({
  useFormatInstant: () => (value: Date, format: string) =>
    `${value.toISOString()}|${format}`,
}));
vi.mock("@/components/users/user-row-actions/user-row-actions", () => ({
  UserRowActions: ({ user }: { user: { name: string } }) => (
    <span>actions for {user.name}</span>
  ),
}));

import { UserTable } from "./user-table";

const rows = [
  {
    id: "u-1",
    email: "owner@example.com",
    firstName: "Olena",
    lastName: "Kovalenko",
    role: "SUPER_ADMIN" as const,
    status: "active" as const,
    createdAt: new Date("2026-09-01T00:00:00Z"),
    pendingInvite: null,
  },
  {
    id: "u-2",
    email: "new@example.com",
    firstName: "Lesya",
    lastName: "Ukrainka",
    role: "ADMIN" as const,
    status: "invited" as const,
    createdAt: new Date("2026-09-20T00:00:00Z"),
    pendingInvite: { expiresAt: new Date("2026-09-23T00:00:00Z") },
  },
];

describe("UserTable (FR-047)", () => {
  it("shows full name, email, role, status and pending invite", () => {
    render(<UserTable users={rows} />);
    const row = screen.getByRole("row", { name: /Lesya Ukrainka/ });

    expect(within(row).getByText("new@example.com")).toBeInTheDocument();
    expect(within(row).getByText("users.roles.ADMIN")).toBeInTheDocument();
    expect(within(row).getByText("users.status.invited")).toBeInTheDocument();
  });

  it("formats each date through the shared mechanism: created as a date, pending expiry as a date and time (FR-011)", () => {
    render(<UserTable users={rows} />);
    const row = screen.getByRole("row", { name: /Lesya Ukrainka/ });

    expect(
      within(row).getByText("2026-09-20T00:00:00.000Z|date"),
    ).toBeInTheDocument();
    expect(
      within(row).getByText("pending until 2026-09-23T00:00:00.000Z|dateTime"),
    ).toBeInTheDocument();
  });

  it("shows no invitation for an account without one", () => {
    render(<UserTable users={rows} />);
    const row = screen.getByRole("row", { name: /Olena Kovalenko/ });

    expect(within(row).getByText("users.list.none")).toBeInTheDocument();
  });

  it("gives each row its actions", () => {
    render(<UserTable users={rows} />);
    expect(screen.getByText("actions for Olena Kovalenko")).toBeInTheDocument();
  });
});
