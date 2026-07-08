"use client";

import { useTranslations } from "next-intl";
import { useActionState } from "react";
import { SubmitButton } from "@/components/form/submit-button";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Link } from "@/i18n/navigation";
import { USER_ROLES } from "@/lib/validations";
import { createUser, updateUser } from "./actions";

export type UserFormValues = {
  id: string;
  name: string;
  email: string;
  role: string;
};

export function UserForm({
  user,
  isSelf = false,
}: {
  user?: UserFormValues;
  /** Editándose a sí misma: el rol se bloquea para no perder el acceso admin. */
  isSelf?: boolean;
}) {
  const t = useTranslations("Users");
  const tForms = useTranslations("Forms");
  const tRole = useTranslations("UserRole");
  const [state, formAction] = useActionState(
    user ? updateUser : createUser,
    null,
  );

  return (
    <form action={formAction} className="max-w-xl space-y-5">
      {user && <input type="hidden" name="id" value={user.id} />}
      {isSelf && <input type="hidden" name="role" value={user?.role} />}

      <div className="space-y-2">
        <Label htmlFor="name">{t("fieldName")}</Label>
        <Input
          id="name"
          name="name"
          required
          maxLength={100}
          defaultValue={user?.name}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="email">{t("fieldEmail")}</Label>
        <Input
          id="email"
          name="email"
          type="email"
          required
          defaultValue={user?.email}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="role">{t("fieldRole")}</Label>
        <Select
          name={isSelf ? undefined : "role"}
          defaultValue={user?.role ?? "USER"}
          disabled={isSelf}
        >
          <SelectTrigger id="role" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {USER_ROLES.map((role) => (
              <SelectItem key={role} value={role}>
                {tRole(role)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {isSelf && (
          <p className="text-xs text-muted-foreground">{t("roleLockedHint")}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="password">
          {user ? t("fieldNewPassword") : t("fieldPassword")}{" "}
          {user && (
            <span className="text-muted-foreground">({tForms("optional")})</span>
          )}
        </Label>
        <Input
          id="password"
          name="password"
          type="password"
          minLength={8}
          required={!user}
          autoComplete="new-password"
        />
        {user && (
          <p className="text-xs text-muted-foreground">{t("passwordHint")}</p>
        )}
      </div>

      {state?.error && (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      )}

      <div className="flex gap-3">
        <SubmitButton />
        <Button variant="outline" asChild>
          <Link href="/dashboard/usuarios">{tForms("cancel")}</Link>
        </Button>
      </div>
    </form>
  );
}
