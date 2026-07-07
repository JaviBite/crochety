"use client";

import { ImagePlus, Plus, Sparkles, Trash2, X } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { type ChangeEvent, useActionState, useRef, useState, useTransition } from "react";
import { ImageCropper } from "@/components/form/image-cropper";
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
import { centsToEur, eurToCents, formatCents } from "@/lib/money";
import { createExpense, extractExpenseAction, updateExpense } from "./actions";

type Option = { id: string; name: string };

type ItemRow = {
  item: string;
  quantity: string;
  unitPriceEur: string;
  link: string;
  addToMaterials: boolean;
};

export type ExpenseFormValues = {
  id: string;
  date: Date;
  store: string | null;
  paidById: string;
  shippingCents: number;
  totalCents: number;
  received: boolean;
  notes: string | null;
  items: {
    item: string;
    quantity: number;
    unitPriceCents: number;
    link: string | null;
  }[];
  photos: { path: string }[];
};

function toDateInputValue(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

const emptyRow = (): ItemRow => ({
  item: "",
  quantity: "1",
  unitPriceEur: "",
  link: "",
  addToMaterials: false,
});

const round2 = (n: number) => Math.round(n * 100) / 100;
const num = (value: string) => {
  const n = Number.parseFloat(value);
  return Number.isFinite(n) ? n : 0;
};

export function ExpenseForm({
  users,
  expense,
}: {
  users: Option[];
  expense?: ExpenseFormValues;
}) {
  const t = useTranslations("Expenses");
  const tForms = useTranslations("Forms");
  const locale = useLocale();
  const [state, formAction] = useActionState(
    expense ? updateExpense : createExpense,
    null,
  );

  const [items, setItems] = useState<ItemRow[]>(() =>
    expense && expense.items.length > 0
      ? expense.items.map((line) => ({
          item: line.item,
          quantity: String(line.quantity),
          unitPriceEur: String(centsToEur(line.unitPriceCents)),
          link: line.link ?? "",
          addToMaterials: false,
        }))
      : [emptyRow()],
  );
  const [shipping, setShipping] = useState(
    expense && expense.shippingCents > 0
      ? String(centsToEur(expense.shippingCents))
      : "",
  );
  const [aiText, setAiText] = useState("");
  const [aiImages, setAiImages] = useState<string[]>([]);
  const [cropSrc, setCropSrc] = useState<string | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);
  const [extracting, startExtract] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);

  const [photoPaths, setPhotoPaths] = useState<string[]>(
    () => expense?.photos.map((photo) => photo.path) ?? [],
  );
  const [photoLinks, setPhotoLinks] = useState<string[]>([]);
  const [linkInput, setLinkInput] = useState("");
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const photoFileRef = useRef<HTMLInputElement>(null);

  const defaultDate = expense
    ? toDateInputValue(expense.date)
    : new Date().toISOString().slice(0, 10);

  function patchRow(index: number, patch: Partial<ItemRow>) {
    setItems((rows) =>
      rows.map((row, i) => (i === index ? { ...row, ...patch } : row)),
    );
  }
  function addRow() {
    setItems((rows) => [...rows, emptyRow()]);
  }
  function removeRow(index: number) {
    setItems((rows) => (rows.length > 1 ? rows.filter((_, i) => i !== index) : rows));
  }

  function onPickImage(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setCropSrc(String(reader.result));
    reader.readAsDataURL(file);
  }

  function runExtract() {
    setAiError(null);
    startExtract(async () => {
      const result = await extractExpenseAction({
        text: aiText.trim() || undefined,
        images: aiImages,
      });
      if (!result.ok) {
        setAiError(result.error);
        return;
      }
      const rows = result.items.map<ItemRow>((line) => {
        const quantity = line.quantity >= 1 ? line.quantity : 1;
        const unit =
          line.unitPriceEur != null && line.unitPriceEur > 0
            ? line.unitPriceEur
            : line.totalEur != null
              ? line.totalEur / quantity
              : 0;
        return {
          item: line.item,
          quantity: String(quantity),
          unitPriceEur: unit > 0 ? String(round2(unit)) : "",
          link: line.link ?? "",
          addToMaterials: false,
        };
      });
      if (rows.length > 0) setItems(rows);
    });
  }

  async function onPickPhoto(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    event.target.value = "";
    if (files.length === 0) return;
    setPhotoError(null);
    setUploadingPhoto(true);
    try {
      for (const file of files) {
        const body = new FormData();
        body.set("file", file);
        body.set("kind", "expenses");
        const res = await fetch("/api/uploads", { method: "POST", body });
        const data = (await res.json().catch(() => null)) as
          | { path?: string; error?: string }
          | null;
        if (res.ok && data?.path) {
          const path = data.path;
          setPhotoPaths((prev) => [...prev, path]);
        } else {
          setPhotoError(data?.error ?? "No se pudo subir la imagen");
        }
      }
    } finally {
      setUploadingPhoto(false);
    }
  }

  function addLink() {
    const value = linkInput.trim();
    if (!value) return;
    setPhotoLinks((prev) => (prev.includes(value) ? prev : [...prev, value]));
    setLinkInput("");
  }

  const linesCents = items.reduce(
    (sum, row) => sum + eurToCents(num(row.unitPriceEur)) * (num(row.quantity) || 0),
    0,
  );
  const autoTotalCents = linesCents + eurToCents(num(shipping));

  // Solo se envían las filas con nombre; el total va como null (auto) salvo ajuste.
  const itemsJson = JSON.stringify(
    items
      .filter((row) => row.item.trim())
      .map((row) => ({
        item: row.item.trim(),
        quantity: Number.parseInt(row.quantity, 10) || 1,
        unitPriceEur: num(row.unitPriceEur),
        totalEur: null,
        link: row.link.trim() || null,
        addToMaterials: row.addToMaterials,
      })),
  );

  return (
    <form action={formAction} className="max-w-2xl space-y-5">
      {expense && <input type="hidden" name="id" value={expense.id} />}
      <input type="hidden" name="items" value={itemsJson} />
      <input type="hidden" name="photoPaths" value={JSON.stringify(photoPaths)} />
      <input type="hidden" name="photoLinks" value={JSON.stringify(photoLinks)} />

      {/* Asistente IA */}
      <fieldset className="space-y-3 rounded-xl border bg-muted/30 p-4">
        <legend className="flex items-center gap-1.5 px-1 text-sm font-medium">
          <Sparkles className="size-4 text-primary" />
          {t("aiTitle")}
        </legend>
        <p className="text-xs text-muted-foreground">{t("aiHint")}</p>
        <Textarea
          rows={2}
          value={aiText}
          onChange={(event) => setAiText(event.target.value)}
          placeholder={t("aiTextPlaceholder")}
        />
        {aiImages.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {aiImages.map((src, index) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={src.slice(-32) + index}
                src={src}
                alt=""
                className="size-16 rounded-lg border object-cover"
              />
            ))}
          </div>
        )}
        <div className="flex flex-wrap items-center gap-2">
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            aria-label={t("aiAddImage")}
            className="hidden"
            onChange={onPickImage}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => fileRef.current?.click()}
          >
            <ImagePlus />
            {t("aiAddImage")}
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={runExtract}
            disabled={extracting || (!aiText.trim() && aiImages.length === 0)}
          >
            <Sparkles />
            {extracting ? t("aiExtracting") : t("aiExtract")}
          </Button>
        </div>
        {aiError && <p className="text-sm text-destructive">{aiError}</p>}
        {cropSrc && (
          <ImageCropper
            src={cropSrc}
            onCropped={(dataUrl) => {
              setAiImages((prev) => [...prev, dataUrl]);
              setCropSrc(null);
            }}
            onCancel={() => setCropSrc(null)}
          />
        )}
      </fieldset>

      {/* Cabecera del recibo */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="space-y-2">
          <Label htmlFor="date">{t("fieldDate")}</Label>
          <Input id="date" name="date" type="date" defaultValue={defaultDate} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="store">
            {t("fieldStore")}{" "}
            <span className="text-muted-foreground">({tForms("optional")})</span>
          </Label>
          <Input id="store" name="store" defaultValue={expense?.store ?? undefined} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="paidById">{t("fieldPaidBy")}</Label>
          <Select name="paidById" defaultValue={expense?.paidById ?? users[0]?.id}>
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
      </div>

      {/* Líneas */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label>{t("itemsTitle")}</Label>
          <Button type="button" variant="outline" size="sm" onClick={addRow}>
            <Plus />
            {t("addItem")}
          </Button>
        </div>
        <div className="space-y-2">
          {items.map((row, index) => (
            <div
              key={index}
              className="grid grid-cols-[1fr_auto] gap-2 rounded-xl border p-3 sm:grid-cols-[1fr_5rem_6rem_auto]"
            >
              <Input
                aria-label={t("colItem")}
                placeholder={t("colItem")}
                value={row.item}
                onChange={(event) => patchRow(index, { item: event.target.value })}
                className="col-span-2 sm:col-span-1"
              />
              <Input
                aria-label={t("colQuantity")}
                type="number"
                min={1}
                step={1}
                value={row.quantity}
                onChange={(event) => patchRow(index, { quantity: event.target.value })}
              />
              <Input
                aria-label={t("colUnitPrice")}
                type="number"
                min={0}
                step="0.01"
                placeholder="0.00"
                value={row.unitPriceEur}
                onChange={(event) =>
                  patchRow(index, { unitPriceEur: event.target.value })
                }
              />
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label={t("removeItem")}
                onClick={() => removeRow(index)}
                className="self-center text-muted-foreground hover:text-destructive"
              >
                <Trash2 />
              </Button>
              <label className="col-span-2 flex items-center gap-2 text-xs text-muted-foreground sm:col-span-4">
                <Checkbox
                  checked={row.addToMaterials}
                  onCheckedChange={(checked) =>
                    patchRow(index, { addToMaterials: checked === true })
                  }
                />
                {t("addToMaterials")}
                <Input
                  aria-label={t("fieldLink")}
                  type="url"
                  placeholder={t("itemLinkPlaceholder")}
                  value={row.link}
                  onChange={(event) => patchRow(index, { link: event.target.value })}
                  className="ml-auto h-7 max-w-52"
                />
              </label>
            </div>
          ))}
        </div>
      </div>

      {/* Totales */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="shippingEur">
            {t("fieldShipping")}{" "}
            <span className="text-muted-foreground">({tForms("optional")})</span>
          </Label>
          <Input
            id="shippingEur"
            name="shippingEur"
            type="number"
            min={0}
            step="0.01"
            placeholder="0.00"
            value={shipping}
            onChange={(event) => setShipping(event.target.value)}
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
            placeholder={formatCents(autoTotalCents, locale)}
            defaultValue={
              expense && expense.totalCents !== autoTotalCents
                ? centsToEur(expense.totalCents)
                : undefined
            }
          />
          <p className="text-xs text-muted-foreground">
            {t("autoTotal", { total: formatCents(autoTotalCents, locale) })}
          </p>
        </div>
      </div>

      <fieldset className="space-y-3 rounded-xl border p-4">
        <legend className="px-1 text-sm font-medium text-muted-foreground">
          {t("photosTitle")}
        </legend>
        {(photoPaths.length > 0 || photoLinks.length > 0) && (
          <div className="flex flex-wrap gap-2">
            {photoPaths.map((path) => (
              <div key={path} className="relative">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`/api/files/${path}`}
                  alt=""
                  className="size-16 rounded-lg border object-cover"
                />
                <button
                  type="button"
                  onClick={() =>
                    setPhotoPaths((prev) => prev.filter((value) => value !== path))
                  }
                  aria-label={tForms("delete")}
                  className="absolute -top-1.5 -right-1.5 rounded-full border bg-background p-0.5 text-muted-foreground hover:text-destructive"
                >
                  <X className="size-3" />
                </button>
              </div>
            ))}
            {photoLinks.map((url) => (
              <div key={url} className="relative">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={url}
                  alt=""
                  className="size-16 rounded-lg border object-cover"
                />
                <button
                  type="button"
                  onClick={() =>
                    setPhotoLinks((prev) => prev.filter((value) => value !== url))
                  }
                  aria-label={tForms("delete")}
                  className="absolute -top-1.5 -right-1.5 rounded-full border bg-background p-0.5 text-muted-foreground hover:text-destructive"
                >
                  <X className="size-3" />
                </button>
              </div>
            ))}
          </div>
        )}
        <input
          ref={photoFileRef}
          type="file"
          accept="image/*"
          multiple
          aria-label={t("photosAdd")}
          className="hidden"
          onChange={onPickPhoto}
        />
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => photoFileRef.current?.click()}
            disabled={uploadingPhoto}
          >
            <ImagePlus />
            {uploadingPhoto ? t("photosUploading") : t("photosAdd")}
          </Button>
          <Input
            type="url"
            placeholder={t("photosLinkPlaceholder")}
            value={linkInput}
            onChange={(event) => setLinkInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                addLink();
              }
            }}
            className="min-w-40 flex-1"
          />
          <Button type="button" variant="outline" size="sm" onClick={addLink}>
            {t("photosAddLink")}
          </Button>
        </div>
        {photoError && <p className="text-sm text-destructive">{photoError}</p>}
        <p className="text-xs text-muted-foreground">{t("photosHint")}</p>
      </fieldset>

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
        <Checkbox id="received" name="received" defaultChecked={expense?.received} />
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
