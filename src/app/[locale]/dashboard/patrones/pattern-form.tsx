"use client";

import { useTranslations } from "next-intl";
import { useActionState } from "react";
import { SubmitButton } from "@/components/form/submit-button";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Link } from "@/i18n/navigation";
import { createPattern } from "./actions";

export function PatternForm() {
  const t = useTranslations("Patterns");
  const tForms = useTranslations("Forms");
  const [state, formAction] = useActionState(createPattern, null);

  return (
    <form action={formAction} className="max-w-xl space-y-5">
      <div className="space-y-2">
        <Label htmlFor="title">{t("fieldTitle")}</Label>
        <Input id="title" name="title" required maxLength={200} />
      </div>

      <div className="space-y-2">
        <Label htmlFor="file">
          {t("fieldFile")}{" "}
          <span className="text-muted-foreground">({tForms("optional")})</span>
        </Label>
        <Input
          id="file"
          name="file"
          type="file"
          accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        />
        <p className="text-xs text-muted-foreground">{t("fileHint")}</p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="externalUrl">
          {t("fieldExternalUrl")}{" "}
          <span className="text-muted-foreground">({tForms("optional")})</span>
        </Label>
        <Input
          id="externalUrl"
          name="externalUrl"
          type="url"
          placeholder="https://…"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="cover">
          {t("fieldCover")}{" "}
          <span className="text-muted-foreground">({tForms("optional")})</span>
        </Label>
        <Input id="cover" name="cover" type="file" accept="image/*" />
      </div>

      {state?.error && (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      )}

      <div className="flex gap-3">
        <SubmitButton />
        <Button variant="outline" asChild>
          <Link href="/dashboard/patrones">{tForms("cancel")}</Link>
        </Button>
      </div>
    </form>
  );
}
