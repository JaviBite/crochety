import { Plus, Users } from "lucide-react";
import { getFormatter, getTranslations } from "next-intl/server";
import { RowActions } from "@/components/dashboard/row-actions";
import { EmptyState } from "@/components/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Link, redirect } from "@/i18n/navigation";
import { auth, isAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { deleteUser } from "./actions";

const BASE_PATH = "/dashboard/usuarios";

export default async function UsersPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const session = await auth();
  if (!isAdmin(session)) redirect({ href: "/dashboard", locale });

  const [t, tRole, format, users] = await Promise.all([
    getTranslations("Users"),
    getTranslations("UserRole"),
    getFormatter(),
    prisma.user.findMany({ orderBy: { createdAt: "asc" } }),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t("title")}</h1>
          <p className="text-muted-foreground">{t("description")}</p>
        </div>
        <Button asChild>
          <Link href={`${BASE_PATH}/nuevo`}>
            <Plus className="size-4" />
            {t("add")}
          </Link>
        </Button>
      </div>

      {users.length === 0 ? (
        <EmptyState
          icon={Users}
          title={t("emptyTitle")}
          description={t("emptyDescription")}
        />
      ) : (
        <div className="overflow-x-auto rounded-2xl border bg-card shadow-sm">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("colName")}</TableHead>
                <TableHead>{t("colEmail")}</TableHead>
                <TableHead>{t("colRole")}</TableHead>
                <TableHead>{t("colCreatedAt")}</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((user) => (
                <TableRow key={user.id}>
                  <TableCell className="font-medium">
                    {user.name}
                    {user.id === session!.user.id && (
                      <span className="ml-2 text-xs text-muted-foreground">
                        {t("youLabel")}
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {user.email}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={
                        user.role === "ADMIN"
                          ? "border-transparent bg-primary/15 text-primary"
                          : "border-transparent bg-muted text-muted-foreground"
                      }
                    >
                      {tRole(user.role === "ADMIN" ? "ADMIN" : "USER")}
                    </Badge>
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-muted-foreground">
                    {format.dateTime(user.createdAt, { dateStyle: "medium" })}
                  </TableCell>
                  <TableCell className="text-right">
                    <RowActions
                      editHref={`${BASE_PATH}/editar/${user.id}`}
                      deleteAction={deleteUser.bind(null, user.id)}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
