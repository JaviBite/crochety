"use client";

import { useTranslations } from "next-intl";
import { useActionState } from "react";
import { SubmitButton } from "@/components/form/submit-button";
import { TagInput } from "@/components/form/tag-input";
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
import { centsToEur } from "@/lib/money";
import { MATERIAL_CATEGORIES } from "@/lib/validations";
import { createMaterial, updateMaterial } from "./actions";
import { MaterialColorField } from "./material-color-field";

export type MaterialFormValues = {
  id: string;
  name: string;
  category: string;
  priceCents: number;
  stock: number;
  location: string | null;
  link: string | null;
  brand: string | null;
  fiberType: string | null;
  weight: string | null;
  colorHex: string | null;
  photoPath: string | null;
  tags: { name: string }[];
};

export function MaterialForm({
  material,
  suggestions = [],
}: {
  material?: MaterialFormValues;
  suggestions?: string[];
}) {
  const t = useTranslations("Materials");
  const tForms = useTranslations("Forms");
  const tCategory = useTranslations("MaterialCategory");
  const [state, formAction] = useActionState(
    material ? updateMaterial : createMaterial,
    null,
  );

  return (
    <form action={formAction} className="max-w-xl space-y-5">
      {material && <input type="hidden" name="id" value={material.id} />}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="name">{t("fieldName")}</Label>
          <Input
            id="name"
            name="name"
            required
            maxLength={200}
            defaultValue={material?.name}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="category">{t("fieldCategory")}</Label>
          <Select name="category" defaultValue={material?.category ?? "LANA"}>
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
            defaultValue={material ? centsToEur(material.priceCents) : undefined}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="stock">{t("fieldStock")}</Label>
          <Input
            id="stock"
            name="stock"
            type="number"
            min={0}
            step="0.5"
            defaultValue={material?.stock ?? 0}
          />
        </div>
        <div className="col-span-2 space-y-2 sm:col-span-1">
          <Label htmlFor="location">
            {t("fieldLocation")}{" "}
            <span className="text-muted-foreground">({tForms("optional")})</span>
          </Label>
          <Input
            id="location"
            name="location"
            defaultValue={material?.location ?? undefined}
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="link">
          {t("fieldLink")}{" "}
          <span className="text-muted-foreground">({tForms("optional")})</span>
        </Label>
        <Input
          id="link"
          name="link"
          type="url"
          placeholder="https://…"
          defaultValue={material?.link ?? undefined}
        />
      </div>

      <fieldset className="space-y-4 rounded-xl border p-4">
        <legend className="px-1 text-sm font-medium text-muted-foreground">
          {t("yarnSection")}
        </legend>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          <div className="space-y-2">
            <Label htmlFor="brand">{t("fieldBrand")}</Label>
            <Input id="brand" name="brand" defaultValue={material?.brand ?? undefined} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="fiberType">{t("fieldFiberType")}</Label>
            <Input
              id="fiberType"
              name="fiberType"
              placeholder={t("fiberPlaceholder")}
              defaultValue={material?.fiberType ?? undefined}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="weight">{t("fieldWeight")}</Label>
            <Input
              id="weight"
              name="weight"
              placeholder="DK"
              defaultValue={material?.weight ?? undefined}
            />
          </div>
        </div>
      </fieldset>

      <div className="space-y-2">
        <Label htmlFor="tags">
          {tForms("tagsLabel")}{" "}
          <span className="text-muted-foreground">({tForms("optional")})</span>
        </Label>
        <TagInput
          id="tags"
          suggestions={suggestions}
          defaultValue={material?.tags.map((tag) => tag.name)}
        />
        <p className="text-xs text-muted-foreground">{tForms("tagsHint")}</p>
      </div>

      <MaterialColorField
        defaultPhotoPath={material?.photoPath}
        defaultColorHex={material?.colorHex}
        defaultHasColor={material ? material.colorHex !== null : true}
      />

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
