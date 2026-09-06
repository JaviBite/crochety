"use client";

import { useTranslations } from "next-intl";
import { useActionState } from "react";
import { SubmitButton } from "@/components/form/submit-button";
import { SuggestInput } from "@/components/form/suggest-input";
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
import { NONE_VALUE } from "@/lib/forms";
import { centsToEur } from "@/lib/money";
import {
  MATERIAL_CATEGORIES,
  YARN_FIBERS,
  YARN_WEIGHTS,
} from "@/lib/validations";
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
  locations = [],
  brands = [],
}: {
  material?: MaterialFormValues;
  suggestions?: string[];
  /** Ubicaciones gestionadas en Ajustes (Setting `locations`). */
  locations?: string[];
  /** Marcas ya usadas en otros materiales, para el datalist. */
  brands?: string[];
}) {
  const t = useTranslations("Materials");
  const tForms = useTranslations("Forms");
  const tCategory = useTranslations("MaterialCategory");
  const [state, formAction] = useActionState(
    material ? updateMaterial : createMaterial,
    null,
  );

  // Selects con conjunto cerrado + valor histórico: si el material guardado
  // tiene un valor que ya no está en la lista, se ofrece como opción extra
  // para que no se pierda al editar.
  const locationOptions: string[] = [...locations];
  if (material?.location && !locationOptions.includes(material.location)) {
    locationOptions.unshift(material.location);
  }
  const fiberOptions: string[] = [...YARN_FIBERS];
  if (material?.fiberType && !fiberOptions.includes(material.fiberType)) {
    fiberOptions.unshift(material.fiberType);
  }
  const weightOptions: string[] = [...YARN_WEIGHTS];
  if (material?.weight && !weightOptions.includes(material.weight)) {
    weightOptions.unshift(material.weight);
  }

  /** Select opcional: primera opción = centinela NONE_VALUE ("—"). */
  function renderOptionalSelect(
    id: string,
    name: string,
    options: readonly string[],
    selected: string | null | undefined,
  ) {
    return (
      <Select name={name} defaultValue={selected ?? NONE_VALUE}>
        <SelectTrigger id={id} className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={NONE_VALUE}>{tForms("none")}</SelectItem>
          {options.map((option) => (
            <SelectItem key={option} value={option}>
              {option}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  }

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
          {renderOptionalSelect("location", "location", locationOptions, material?.location)}
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
            <SuggestInput
              id="brand"
              name="brand"
              options={brands}
              defaultValue={material?.brand ?? undefined}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="fiberType">{t("fieldFiberType")}</Label>
            {renderOptionalSelect("fiberType", "fiberType", fiberOptions, material?.fiberType)}
          </div>
          <div className="space-y-2">
            <Label htmlFor="weight">{t("fieldWeight")}</Label>
            {renderOptionalSelect("weight", "weight", weightOptions, material?.weight)}
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
