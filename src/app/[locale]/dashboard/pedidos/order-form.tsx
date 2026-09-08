"use client";

import { useTranslations } from "next-intl";
import { useActionState, useState } from "react";
import { ComboboxField } from "@/components/form/combobox-field";
import { FileField } from "@/components/form/file-field";
import { FormFooter } from "@/components/form/form-footer";
import { SubmitButton } from "@/components/form/submit-button";
import { SuggestInput } from "@/components/form/suggest-input";
import { AssetImage } from "@/components/asset-image";
import { assetUrl } from "@/lib/assets";
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
import { Textarea } from "@/components/ui/textarea";
import { Link } from "@/i18n/navigation";
import { toDateInputValue } from "@/lib/dates";
import { NONE_VALUE } from "@/lib/forms";
import { centsToEur } from "@/lib/money";
import { cn } from "@/lib/utils";
import { ORDER_STATUSES } from "@/lib/validations";
import { createOrder, updateOrder } from "./actions";
import {
  OrderMaterialsField,
  type MaterialOption,
  type OrderMaterialLine,
} from "./order-materials-field";

type Option = { id: string; name: string };
type PatternOption = { id: string; title: string };

export type OrderFormValues = {
  id: string;
  name: string;
  description: string | null;
  quantity: number;
  priceCents: number;
  status: string;
  customer: string | null;
  assignedToId: string | null;
  patternId: string | null;
  dueDate: Date | null;
  isPublic: boolean;
  coverPhotoPath: string | null;
  materials: OrderMaterialLine[];
};

export function OrderForm({
  users,
  patterns,
  materials,
  order,
  customers = [],
}: {
  users: Option[];
  patterns: PatternOption[];
  materials: MaterialOption[];
  order?: OrderFormValues;
  /** Clientes ya asignados en otros pedidos, para el datalist. */
  customers?: string[];
}) {
  const t = useTranslations("Orders");
  const tForms = useTranslations("Forms");
  const tStatus = useTranslations("OrderStatus");
  const [state, formAction] = useActionState(
    order ? updateOrder : createOrder,
    null,
  );
  // Controlado para que la calculadora pueda aplicar el precio sugerido.
  const [priceEur, setPriceEur] = useState(
    order ? String(centsToEur(order.priceCents)) : "",
  );

  return (
    <form action={formAction} className="max-w-xl space-y-5">
      {order && <input type="hidden" name="id" value={order.id} />}

      <div className="space-y-2">
        <Label htmlFor="name">{t("fieldName")}</Label>
        <Input
          id="name"
          name="name"
          required
          maxLength={200}
          defaultValue={order?.name}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">
          {t("fieldDescription")}{" "}
          <span className="text-muted-foreground">({tForms("optional")})</span>
        </Label>
        <Textarea
          id="description"
          name="description"
          rows={3}
          defaultValue={order?.description ?? undefined}
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="quantity">{t("fieldQuantity")}</Label>
          <Input
            id="quantity"
            name="quantity"
            type="number"
            min={1}
            step={1}
            defaultValue={order?.quantity ?? 1}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="priceEur">{t("fieldPrice")}</Label>
          <Input
            id="priceEur"
            name="priceEur"
            type="number"
            min={0}
            step="0.01"
            placeholder="0.00"
            value={priceEur}
            onChange={(event) => setPriceEur(event.target.value)}
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label>{t("fieldStatus")}</Label>
        {/* Pills segmentadas: radios nativos escondidos estilizan la píldora
            con :has(:checked) y el valor viaja con el form sin JS extra. */}
        <div
          role="radiogroup"
          aria-label={t("fieldStatus")}
          className="flex flex-wrap gap-1 rounded-full border bg-muted/50 p-1"
        >
          {ORDER_STATUSES.map((status) => (
            <label
              key={status}
              className={cn(
                "cursor-pointer rounded-full px-3 py-1.5 text-sm font-medium transition-colors",
                "text-muted-foreground hover:text-foreground",
                "has-checked:bg-primary has-checked:text-primary-foreground has-checked:shadow-sm",
              )}
            >
              <input
                type="radio"
                name="status"
                value={status}
                defaultChecked={status === (order?.status ?? "SIN_EMPEZAR")}
                className="sr-only"
              />
              {tStatus(status)}
            </label>
          ))}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="customer">
            {t("fieldCustomer")}{" "}
            <span className="text-muted-foreground">({tForms("optional")})</span>
          </Label>
          <SuggestInput
            id="customer"
            name="customer"
            options={customers}
            defaultValue={order?.customer ?? undefined}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="assignedToId">{t("fieldAssignedTo")}</Label>
          <Select
            name="assignedToId"
            defaultValue={order?.assignedToId ?? NONE_VALUE}
          >
            <SelectTrigger id="assignedToId" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE_VALUE}>{tForms("none")}</SelectItem>
              {users.map((user) => (
                <SelectItem key={user.id} value={user.id}>
                  {user.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="patternId">{t("fieldPattern")}</Label>
          {/* Combobox buscable: con muchos patrones el select plano no da
              abasto. Valor en input hidden ("" = ninguno, optId lo trata). */}
          <ComboboxField
            id="patternId"
            name="patternId"
            options={patterns.map((pattern) => ({
              value: pattern.id,
              label: pattern.title,
            }))}
            defaultValue={order?.patternId ?? ""}
            placeholder={tForms("none")}
            allowClear
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="dueDate">
            {t("fieldDueDate")}{" "}
            <span className="text-muted-foreground">({tForms("optional")})</span>
          </Label>
          <Input
            id="dueDate"
            name="dueDate"
            type="date"
            defaultValue={order?.dueDate ? toDateInputValue(order.dueDate) : undefined}
          />
        </div>
      </div>

      <OrderMaterialsField
        materials={materials}
        initialLines={order?.materials}
        onApplySuggested={(eur) => setPriceEur(eur.toFixed(2))}
      />

      <div className="space-y-2">
        <Label htmlFor="photo">
          {t("fieldPhoto")}{" "}
          <span className="text-muted-foreground">({tForms("optional")})</span>
        </Label>
        <FileField
          id="photo"
          name="photo"
          accept="image/*"
        >
          {order?.coverPhotoPath && (
            <AssetImage
              src={assetUrl(order.coverPhotoPath)}
              alt={order.name}
              className="size-20 rounded-lg border object-cover"
            />
          )}
        </FileField>
      </div>

      <div className="flex items-start gap-3 rounded-xl border p-4">
        <Checkbox
          id="isPublic"
          name="isPublic"
          className="mt-0.5"
          defaultChecked={order?.isPublic}
        />
        <div className="space-y-1">
          <Label htmlFor="isPublic">{t("fieldIsPublic")}</Label>
          <p className="text-sm text-muted-foreground">{t("fieldIsPublicHint")}</p>
        </div>
      </div>

      {state?.error && (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      )}

      <FormFooter>
        <SubmitButton />
        <Button variant="outline" asChild>
          <Link href="/dashboard/pedidos">{tForms("cancel")}</Link>
        </Button>
      </FormFooter>
    </form>
  );
}
