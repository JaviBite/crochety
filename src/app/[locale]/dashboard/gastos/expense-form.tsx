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
import { createExpense } from "./actions";

type Option = { id: string; name: string };

export function ExpenseForm({ users }: { users: Option[] }) {
  const t = useTranslations("Expenses");
  const tForms = useTranslations("Forms");
  const [state, formAction] = useActionState(createExpense, null);
  const today = new Date().toISOString().slice(0, 10);

  return (
    <form action={formAction} className="max-w-xl space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="item">{t("fieldItem")}</Label>
          <Input id="item" name="item" required maxLength={200} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="date">{t("fieldDate")}</Label>
          <Input id="date" name="date" type="date" defaultValue={today} />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="link">
          {t("fieldLink")}{" "}
          <span className="text-muted-foreground">({tForms("optional")})</span>
        </Label>
        <Input id="link" name="link" type="url" placeholder="https://…" />
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
            defaultValue={1}
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
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="paidById">{t("fieldPaidBy")}</Label>
        <Select name="paidById" defaultValue={users[0]?.id}>
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
        <Textarea id="notes" name="notes" rows={2} />
      </div>

      <div className="flex items-center gap-3 rounded-xl border p-4">
        <Checkbox id="received" name="received" />
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
