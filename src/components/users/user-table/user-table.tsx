"use client";

import { useTranslations } from "next-intl";

import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  type RowUser,
  UserRowActions,
} from "@/components/users/user-row-actions/user-row-actions";
import { useFormatInstant } from "@/i18n/use-format-instant";

export type UserTableRow = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: RowUser["role"];
  status: RowUser["status"];
  createdAt: Date;
  pendingInvite: { expiresAt: Date } | null;
};

const STATUS_VARIANT = {
  active: "default",
  invited: "secondary",
  deactivated: "outline",
} as const;

export function UserTable({ users }: { users: UserTableRow[] }) {
  const t = useTranslations();
  const formatInstant = useFormatInstant();

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>{t("users.list.name")}</TableHead>
          <TableHead>{t("users.list.email")}</TableHead>
          <TableHead>{t("users.list.role")}</TableHead>
          <TableHead>{t("users.list.status")}</TableHead>
          <TableHead>{t("users.list.created")}</TableHead>
          <TableHead>{t("users.list.invite")}</TableHead>
          <TableHead className="sticky right-0 bg-background">
            <span className="sr-only">{t("users.list.actions")}</span>
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {users.map((user) => {
          const name = t("common.fullName", {
            firstName: user.firstName,
            lastName: user.lastName,
          });
          return (
            <TableRow key={user.id} className="group">
              <TableCell className="font-medium">{name}</TableCell>
              <TableCell>{user.email}</TableCell>
              <TableCell>{t(`users.roles.${user.role}`)}</TableCell>
              <TableCell>
                <Badge variant={STATUS_VARIANT[user.status]}>
                  {t(`users.status.${user.status}`)}
                </Badge>
              </TableCell>
              <TableCell>{formatInstant(user.createdAt, "date")}</TableCell>
              <TableCell className="min-w-40 whitespace-normal">
                {user.pendingInvite
                  ? t("users.list.pendingUntil", {
                      expiresAt: formatInstant(
                        user.pendingInvite.expiresAt,
                        "dateTime",
                      ),
                    })
                  : t("users.list.none")}
              </TableCell>
              {/* Opaque, so scrolled cells don't show through; the blend matches the row's translucent hover. */}
              <TableCell className="sticky right-0 bg-background text-right group-hover:bg-[color-mix(in_oklab,var(--color-muted)_50%,var(--color-background))] group-has-aria-expanded:bg-[color-mix(in_oklab,var(--color-muted)_50%,var(--color-background))]">
                <UserRowActions
                  user={{
                    id: user.id,
                    name,
                    role: user.role,
                    status: user.status,
                    hasPendingInvite: user.pendingInvite !== null,
                  }}
                />
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
