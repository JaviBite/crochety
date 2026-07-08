"use client";

import { Calculator, Plus, X } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useMemo, useState } from "react";
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
import { centsToEur, formatCents } from "@/lib/money";
import { materialsCostCents, suggestedPriceCents } from "@/lib/pricing";

export type MaterialOption = { id: string; name: string; priceCents: number };
export type OrderMaterialLine = { materialId: string; quantity: number };

// La cantidad se mantiene como texto mientras se edita (admite "0.5" a medias);
// al serializar cae a número.
type EditableLine = { materialId: string; quantity: string };

function toQuantity(raw: string): number {
  const value = Number.parseFloat(raw);
  return Number.isFinite(value) && value > 0 ? value : 1;
}

/**
 * Materiales usados en el pedido + calculadora de precio sugerido
 * (coste × multiplicador, redondeado a 0,50 €). Las líneas viajan en el campo
 * oculto `materials` como JSON, igual que los productos de un gasto.
 */
export function OrderMaterialsField({
  materials,
  initialLines = [],
  onApplySuggested,
}: {
  materials: MaterialOption[];
  initialLines?: OrderMaterialLine[];
  onApplySuggested: (priceEur: number) => void;
}) {
  const t = useTranslations("Orders");
  const locale = useLocale();
  const [lines, setLines] = useState<EditableLine[]>(
    initialLines.map((line) => ({
      materialId: line.materialId,
      quantity: String(line.quantity),
    })),
  );
  const [multiplier, setMultiplier] = useState("3");

  const priceById = useMemo(
    () => new Map(materials.map((m) => [m.id, m.priceCents])),
    [materials],
  );

  const costCents = materialsCostCents(
    lines
      .filter((line) => line.materialId)
      .map((line) => ({
        priceCents: priceById.get(line.materialId) ?? 0,
        quantity: toQuantity(line.quantity),
      })),
  );
  const multiplierValue = Number.parseFloat(multiplier);
  const suggestedCents = suggestedPriceCents(
    costCents,
    Number.isFinite(multiplierValue) ? multiplierValue : 0,
  );

  const serialized = JSON.stringify(
    lines
      .filter((line) => line.materialId)
      .map((line) => ({
        materialId: line.materialId,
        quantity: toQuantity(line.quantity),
      })),
  );

  function updateLine(index: number, patch: Partial<EditableLine>) {
    setLines((current) =>
      current.map((line, i) => (i === index ? { ...line, ...patch } : line)),
    );
  }

  return (
    <div className="space-y-3 rounded-xl border p-4">
      <input type="hidden" name="materials" value={serialized} />

      <div className="flex items-center justify-between gap-2">
        <Label>{t("materialsTitle")}</Label>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() =>
            setLines((current) => [...current, { materialId: "", quantity: "1" }])
          }
        >
          <Plus className="size-4" />
          {t("addMaterial")}
        </Button>
      </div>

      {lines.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("materialsEmpty")}</p>
      ) : (
        <div className="space-y-2">
          {lines.map((line, index) => (
            <div key={index} className="flex items-center gap-2">
              <Select
                value={line.materialId || undefined}
                onValueChange={(value) => updateLine(index, { materialId: value })}
              >
                <SelectTrigger className="min-w-0 flex-1">
                  <SelectValue placeholder={t("selectMaterial")} />
                </SelectTrigger>
                <SelectContent>
                  {materials.map((material) => (
                    <SelectItem key={material.id} value={material.id}>
                      {material.name} · {formatCents(material.priceCents, locale)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input
                type="number"
                min={0}
                step="0.1"
                className="w-20"
                aria-label={t("materialQuantity")}
                value={line.quantity}
                onChange={(event) =>
                  updateLine(index, { quantity: event.target.value })
                }
              />
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label={t("removeMaterial")}
                className="text-muted-foreground hover:text-destructive"
                onClick={() =>
                  setLines((current) => current.filter((_, i) => i !== index))
                }
              >
                <X />
              </Button>
            </div>
          ))}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-t pt-3 text-sm">
        <span className="flex items-center gap-1.5 text-muted-foreground">
          <Calculator className="size-4" />
          {t("materialsCost", { cost: formatCents(costCents, locale) })}
        </span>
        <span className="flex items-center gap-1.5">
          ×
          <Input
            type="number"
            min={1}
            step="0.5"
            className="h-8 w-16"
            aria-label={t("multiplierLabel")}
            value={multiplier}
            onChange={(event) => setMultiplier(event.target.value)}
          />
        </span>
        <span className="font-medium">
          {t("suggestedPrice", {
            price: formatCents(suggestedCents, locale),
          })}
        </span>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          disabled={suggestedCents === 0}
          onClick={() => onApplySuggested(centsToEur(suggestedCents))}
        >
          {t("applySuggested")}
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">{t("suggestedHint")}</p>
    </div>
  );
}
