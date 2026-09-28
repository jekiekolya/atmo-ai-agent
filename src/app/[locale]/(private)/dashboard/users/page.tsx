import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { requireSuperAdmin } from "@/auth/dal";
import { CreateUserForm } from "@/components/create-user-form/create-user-form";
import { NotPermitted } from "@/components/not-permitted/not-permitted";
import { UserTable } from "@/components/user-table/user-table";
import { listUsers } from "@/server/users/user-service";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("users");
  return { title: t("metaTitle") };
}

export default async function UsersPage() {
  const { user, permitted } = await requireSuperAdmin();
  if (!permitted) return <NotPermitted />;

  const t = await getTranslations("users");
  const users = await listUsers(user);

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6 p-4 sm:p-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-medium">{t("title")}</h1>
        <CreateUserForm />
      </div>
      <UserTable users={users} />
    </div>
  );
}
