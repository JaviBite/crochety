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
import { Textarea } from "@/components/ui/textarea";
import { Link } from "@/i18n/navigation";
import { NONE_VALUE } from "@/lib/forms";
import { centsToEur } from "@/lib/money";
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

/** Date -> "YYYY-MM-DD" en la zona local (evita el desfase de toISOString). */
function toDateInputValue(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function OrderForm({
  users,
  patterns,
  materials,
  order,
}: {
  users: Option[];
  patterns: PatternOption[];
  materials: MaterialOption[];
  order?: OrderFormValues;
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

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
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
        <div className="col-span-2 space-y-2 sm:col-span-1">
          <Label htmlFor="status">{t("fieldStatus")}</Label>
          <Select name="status" defaultValue={order?.status ?? "SIN_EMPEZAR"}>
            <SelectTrigger id="status" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ORDER_STATUSES.map((status) => (
                <SelectItem key={status} value={status}>
                  {tStatus(status)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="customer">
            {t("fieldCustomer")}{" "}
            <span className="text-muted-foreground">({tForms("optional")})</span>
          </Label>
          <Input
            id="customer"
            name="customer"
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
          <Select name="patternId" defaultValue={order?.patternId ?? NONE_VALUE}>
            <SelectTrigger id="patternId" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE_VALUE}>{tForms("none")}</SelectItem>
              {patterns.map((pattern) => (
                <SelectItem key={pattern.id} value={pattern.id}>
                  {pattern.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
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
        {order?.coverPhotoPath && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={`/api/files/${order.coverPhotoPath}`}
            alt={order.name}
            className="size-20 rounded-lg border object-cover"
          />
        )}
        <Input id="photo" name="photo" type="file" accept="image/*" />
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

      <div className="flex gap-3">
        <SubmitButton />
        <Button variant="outline" asChild>
          <Link href="/dashboard/pedidos">{tForms("cancel")}</Link>
        </Button>
      </div>
    </form>
  );
}
