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
import { avatarHue, initialsOf } from "@/lib/avatar";
import { prisma } from "@/lib/prisma";
import { deleteUser } from "./actions";

const BASE_PATH = "/dashboard/usuarios";

type CssWithHue = React.CSSProperties & { "--avatar-h": number };

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
          <h1 className="h1-display">{t("title")}</h1>
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
          icon={<Users className="size-6" />}
          title={t("emptyTitle")}
          description={t("emptyDescription")}
        />
      ) : (
        <div className="overflow-x-auto rounded-2xl border bg-card shadow-sm">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("colName")}</TableHead>
                <TableHead className="hidden md:table-cell">{t("colEmail")}</TableHead>
                <TableHead>{t("colRole")}</TableHead>
                <TableHead>{t("colBalance")}</TableHead>
                <TableHead className="hidden sm:table-cell">{t("colCreatedAt")}</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((user) => (
                <TableRow key={user.id}>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-3">
                      <span
                        className="initials-avatar flex size-9 shrink-0 items-center justify-center rounded-full font-heading text-xs font-bold"
                        style={{ "--avatar-h": avatarHue(user.name) } as CssWithHue}
                        aria-hidden
                      >
                        {initialsOf(user.name)}
                      </span>
                      <div>
                        {user.name}
                        {user.id === session!.user.id && (
                          <span className="ml-2 text-xs text-muted-foreground">
                            {t("youLabel")}
                          </span>
                        )}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="hidden text-muted-foreground md:table-cell">
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
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={
                        user.participates
                          ? "border-transparent bg-muted text-muted-foreground"
                          : "border-transparent bg-amber-500/15 text-amber-700 dark:text-amber-400"
                      }
                    >
                      {user.participates ? t("balanceYes") : t("balanceNo")}
                    </Badge>
                  </TableCell>
                  <TableCell className="hidden whitespace-nowrap text-muted-foreground sm:table-cell">
                    {format.dateTime(user.createdAt, { dateStyle: "medium" })}
                  </TableCell>
                  <TableCell className="text-right">
                    <RowActions
                      editHref={`${BASE_PATH}/editar/${user.id}`}
                      deleteAction={deleteUser.bind(null, user.id)}
                      entityName={user.name}
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
