"use client";

import { useFormStatus } from "react-dom";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";

export function SubmitButton() {
  const t = useTranslations("Forms");
  const { pending } = useFormStatus();

  return (
    <Button type="submit" disabled={pending}>
      {pending ? t("saving") : t("save")}
    </Button>
  );
}
