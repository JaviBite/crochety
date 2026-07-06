"use client";

import { useTranslations } from "next-intl";
import { useActionState } from "react";
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
import { ORDER_STATUSES } from "@/lib/validations";
import { createOrder } from "./actions";

type Option = { id: string; name: string };
type PatternOption = { id: string; title: string };

export function OrderForm({
  users,
  patterns,
}: {
  users: Option[];
  patterns: PatternOption[];
}) {
  const t = useTranslations("Orders");
  const tForms = useTranslations("Forms");
  const tStatus = useTranslations("OrderStatus");
  const [state, formAction] = useActionState(createOrder, null);

  return (
    <form action={formAction} className="max-w-xl space-y-5">
      <div className="space-y-2">
        <Label htmlFor="name">{t("fieldName")}</Label>
        <Input id="name" name="name" required maxLength={200} />
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">
          {t("fieldDescription")}{" "}
          <span className="text-muted-foreground">({tForms("optional")})</span>
        </Label>
        <Textarea id="description" name="description" rows={3} />
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
            defaultValue={1}
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
          />
        </div>
        <div className="col-span-2 space-y-2 sm:col-span-1">
          <Label htmlFor="status">{t("fieldStatus")}</Label>
          <Select name="status" defaultValue="SIN_EMPEZAR">
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
          <Input id="customer" name="customer" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="assignedToId">{t("fieldAssignedTo")}</Label>
          <Select name="assignedToId" defaultValue={NONE_VALUE}>
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
          <Select name="patternId" defaultValue={NONE_VALUE}>
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
          <Input id="dueDate" name="dueDate" type="date" />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="photo">
          {t("fieldPhoto")}{" "}
          <span className="text-muted-foreground">({tForms("optional")})</span>
        </Label>
        <Input id="photo" name="photo" type="file" accept="image/*" />
      </div>

      <div className="flex items-start gap-3 rounded-xl border p-4">
        <Checkbox id="isPublic" name="isPublic" className="mt-0.5" />
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
