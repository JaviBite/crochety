"use client";

import { X } from "lucide-react";
import { useTranslations } from "next-intl";
import { type KeyboardEvent, useId, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { MAX_TAG_LENGTH, MAX_TAGS } from "@/lib/tags";

function normalize(value: string): string {
  return value.trim().toLowerCase().slice(0, MAX_TAG_LENGTH);
}

/**
 * Editor de etiquetas en formato "chips". Mantiene el array en estado y lo
 * vuelca en un input oculto (coma-separado) para que viaje con el form nativo.
 * El servidor re-normaliza con parseTagNames, así que aquí basta con ser laxos.
 */
export function TagInput({
  id,
  name = "tags",
  defaultValue = [],
  suggestions = [],
}: {
  id?: string;
  name?: string;
  defaultValue?: string[];
  suggestions?: string[];
}) {
  const t = useTranslations("Forms");
  const [tags, setTags] = useState<string[]>(() => defaultValue);
  const [draft, setDraft] = useState("");
  const listId = useId();

  function addTag(raw: string) {
    const value = normalize(raw);
    setDraft("");
    if (!value) return;
    setTags((prev) =>
      prev.includes(value) || prev.length >= MAX_TAGS ? prev : [...prev, value],
    );
  }

  function removeTag(tag: string) {
    setTags((prev) => prev.filter((current) => current !== tag));
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter" || event.key === ",") {
      event.preventDefault();
      addTag(draft);
    } else if (event.key === "Backspace" && !draft && tags.length > 0) {
      removeTag(tags[tags.length - 1]);
    }
  }

  const available = suggestions.filter((tag) => !tags.includes(tag));

  return (
    <div className="space-y-1.5">
      <input type="hidden" name={name} value={tags.join(",")} />
      <div className="flex flex-wrap items-center gap-1.5 rounded-lg border border-input bg-transparent p-1.5 transition-colors focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50 dark:bg-input/30">
        {tags.map((tag) => (
          <Badge key={tag} variant="secondary" className="gap-1 pr-1">
            {tag}
            <button
              type="button"
              onClick={() => removeTag(tag)}
              aria-label={t("tagRemove", { tag })}
              className="rounded-full opacity-70 transition-opacity hover:opacity-100"
            >
              <X className="size-3" />
            </button>
          </Badge>
        ))}
        <input
          id={id}
          list={available.length > 0 ? listId : undefined}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={onKeyDown}
          onBlur={() => addTag(draft)}
          maxLength={MAX_TAG_LENGTH}
          placeholder={tags.length === 0 ? t("tagsPlaceholder") : undefined}
          className="h-6 min-w-28 flex-1 bg-transparent px-1 text-sm outline-none placeholder:text-muted-foreground"
        />
      </div>
      {available.length > 0 && (
        <datalist id={listId}>
          {available.map((tag) => (
            <option key={tag} value={tag} />
          ))}
        </datalist>
      )}
    </div>
  );
}
