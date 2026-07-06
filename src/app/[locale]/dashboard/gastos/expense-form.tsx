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
import { centsToEur } from "@/lib/money";
import { createExpense, updateExpense } from "./actions";

type Option = { id: string; name: string };

export type ExpenseFormValues = {
  id: string;
  date: Date;
  item: string;
  link: string | null;
  quantity: number;
  unitPriceCents: number;
  totalCents: number;
  paidById: string;
  received: boolean;
  notes: string | null;
};

/** Date -> "YYYY-MM-DD" en la zona local (evita el desfase de toISOString). */
function toDateInputValue(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function ExpenseForm({
  users,
  expense,
}: {
  users: Option[];
  expense?: ExpenseFormValues;
}) {
  const t = useTranslations("Expenses");
  const tForms = useTranslations("Forms");
  const [state, formAction] = useActionState(
    expense ? updateExpense : createExpense,
    null,
  );
  const defaultDate = expense
    ? toDateInputValue(expense.date)
    : new Date().toISOString().slice(0, 10);

  return (
    <form action={formAction} className="max-w-xl space-y-5">
      {expense && <input type="hidden" name="id" value={expense.id} />}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="item">{t("fieldItem")}</Label>
          <Input
            id="item"
            name="item"
            required
            maxLength={200}
            defaultValue={expense?.item}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="date">{t("fieldDate")}</Label>
          <Input id="date" name="date" type="date" defaultValue={defaultDate} />
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
          defaultValue={expense?.link ?? undefined}
        />
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="space-y-2">
          <Label htmlFor="quantity">{t("fieldQuantity")}</Label>
          <Input
            id="quantity"
            name="quantity"
            type="number"
            min={1}
            step={1}
            defaultValue={expense?.quantity ?? 1}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="unitPriceEur">{t("fieldUnitPrice")}</Label>
          <Input
            id="unitPriceEur"
            name="unitPriceEur"
            type="number"
            min={0}
            step="0.01"
            placeholder="0.00"
            defaultValue={
              expense ? centsToEur(expense.unitPriceCents) : undefined
            }
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="totalEur">{t("fieldTotal")}</Label>
          <Input
            id="totalEur"
            name="totalEur"
            type="number"
            min={0}
            step="0.01"
            placeholder={t("totalPlaceholder")}
            defaultValue={expense ? centsToEur(expense.totalCents) : undefined}
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="paidById">{t("fieldPaidBy")}</Label>
        <Select
          name="paidById"
          defaultValue={expense?.paidById ?? users[0]?.id}
        >
          <SelectTrigger id="paidById" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {users.map((user) => (
              <SelectItem key={user.id} value={user.id}>
                {user.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="notes">
          {t("fieldNotes")}{" "}
          <span className="text-muted-foreground">({tForms("optional")})</span>
        </Label>
        <Textarea
          id="notes"
          name="notes"
          rows={2}
          defaultValue={expense?.notes ?? undefined}
        />
      </div>

      <div className="flex items-center gap-3 rounded-xl border p-4">
        <Checkbox
          id="received"
          name="received"
          defaultChecked={expense?.received}
        />
        <Label htmlFor="received">{t("fieldReceived")}</Label>
      </div>

      {state?.error && (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      )}

      <div className="flex gap-3">
        <SubmitButton />
        <Button variant="outline" asChild>
          <Link href="/dashboard/gastos">{tForms("cancel")}</Link>
        </Button>
      </div>
    </form>
  );
}
