"use client";

import { useTranslations } from "next-intl";
import { useActionState, useEffect, useRef } from "react";
import { SubmitButton } from "@/components/form/submit-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { updateProfile } from "./actions";

export function ProfileForm({
  user,
}: {
  user: { name: string; email: string };
}) {
  const t = useTranslations("Profile");
  const [state, formAction] = useActionState(updateProfile, null);

  // Tras guardar con éxito se vacían los campos de contraseña (el resto del
  // formulario conserva los valores nuevos, que ya son los persistidos).
  const formRef = useRef<HTMLFormElement>(null);
  const success = state != null && "success" in state;
  useEffect(() => {
    if (!success) return;
    const inputs =
      formRef.current?.querySelectorAll<HTMLInputElement>(
        "input[type='password']",
      ) ?? [];
    for (const input of inputs) input.value = "";
  }, [success, state]);

  return (
    <form ref={formRef} action={formAction} className="max-w-xl space-y-5">
      <div className="space-y-2">
        <Label htmlFor="name">{t("fieldName")}</Label>
        <Input
          id="name"
          name="name"
          required
          maxLength={100}
          defaultValue={user.name}
          autoComplete="name"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="email">{t("fieldEmail")}</Label>
        <Input
          id="email"
          name="email"
          type="email"
          required
          defaultValue={user.email}
          autoComplete="email"
        />
      </div>

      <div className="space-y-4 rounded-xl border p-4">
        <div className="space-y-1">
          <p className="font-medium">{t("passwordTitle")}</p>
          <p className="text-sm text-muted-foreground">{t("passwordHint")}</p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="currentPassword">{t("fieldCurrentPassword")}</Label>
          <Input
            id="currentPassword"
            name="currentPassword"
            type="password"
            autoComplete="current-password"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="newPassword">{t("fieldNewPassword")}</Label>
          <Input
            id="newPassword"
            name="newPassword"
            type="password"
            minLength={8}
            autoComplete="new-password"
          />
        </div>
      </div>

      {state != null && "error" in state && (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      )}
      {success && (
        <p role="status" className="text-sm text-primary">
          {t("saved")}
        </p>
      )}

      <div className="flex gap-3">
        <SubmitButton />
      </div>
    </form>
  );
}
