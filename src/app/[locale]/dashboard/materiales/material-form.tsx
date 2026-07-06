"use client";

import { useTranslations } from "next-intl";
import { useActionState, useState } from "react";
import { SubmitButton } from "@/components/form/submit-button";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
import { MATERIAL_CATEGORIES } from "@/lib/validations";
import { createMaterial } from "./actions";

export function MaterialForm() {
  const t = useTranslations("Materials");
  const tForms = useTranslations("Forms");
  const tCategory = useTranslations("MaterialCategory");
  const [state, formAction] = useActionState(createMaterial, null);
  const [hasColor, setHasColor] = useState(true);

  return (
    <form action={formAction} className="max-w-xl space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="name">{t("fieldName")}</Label>
          <Input id="name" name="name" required maxLength={200} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="category">{t("fieldCategory")}</Label>
          <Select name="category" defaultValue="LANA">
            <SelectTrigger id="category" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {MATERIAL_CATEGORIES.map((category) => (
                <SelectItem key={category} value={category}>
                  {tCategory(category)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <div className="space-y-2">
          <Label htmlFor="priceEur">{t("fieldPrice")}</Label>
          <Input
            id="priceEur"
            name="priceEur"
            type="number"
            min={0}
            step="0.01"
            placeholder="0.00"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="stock">{t("fieldStock")}</Label>
          <Input id="stock" name="stock" type="number" min={0} step="0.5" defaultValue={0} />
        </div>
        <div className="col-span-2 space-y-2 sm:col-span-1">
          <Label htmlFor="location">
            {t("fieldLocation")}{" "}
            <span className="text-muted-foreground">({tForms("optional")})</span>
          </Label>
          <Input id="location" name="location" />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="link">
          {t("fieldLink")}{" "}
          <span className="text-muted-foreground">({tForms("optional")})</span>
        </Label>
        <Input id="link" name="link" type="url" placeholder="https://…" />
      </div>

      <fieldset className="space-y-4 rounded-xl border p-4">
        <legend className="px-1 text-sm font-medium text-muted-foreground">
          {t("yarnSection")}
        </legend>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          <div className="space-y-2">
            <Label htmlFor="brand">{t("fieldBrand")}</Label>
            <Input id="brand" name="brand" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="fiberType">{t("fieldFiberType")}</Label>
            <Input id="fiberType" name="fiberType" placeholder={t("fiberPlaceholder")} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="weight">{t("fieldWeight")}</Label>
            <Input id="weight" name="weight" placeholder="DK" />
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Checkbox
            id="hasColor"
            name="hasColor"
            checked={hasColor}
            onCheckedChange={(checked) => setHasColor(checked === true)}
          />
          <Label htmlFor="hasColor">{t("fieldHasColor")}</Label>
          <Input
            id="colorHex"
            name="colorHex"
            type="color"
            defaultValue="#a3e2c8"
            disabled={!hasColor}
            className="h-9 w-16 cursor-pointer p-1"
            aria-label={t("fieldColor")}
          />
        </div>
        <p className="text-xs text-muted-foreground">{t("colorHint")}</p>
      </fieldset>

      <div className="space-y-2">
        <Label htmlFor="photo">
          {t("fieldPhoto")}{" "}
          <span className="text-muted-foreground">({tForms("optional")})</span>
        </Label>
        <Input id="photo" name="photo" type="file" accept="image/*" />
      </div>

      {state?.error && (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      )}

      <div className="flex gap-3">
        <SubmitButton />
        <Button variant="outline" asChild>
          <Link href="/dashboard/materiales">{tForms("cancel")}</Link>
        </Button>
      </div>
    </form>
  );
}
