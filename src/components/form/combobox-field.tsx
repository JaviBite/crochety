"use client";

import { CheckIcon, ChevronDownIcon, XIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import * as React from "react";
import { Popover as PopoverPrimitive } from "radix-ui";
import { cn } from "@/lib/utils";

export type ComboboxOption = { value: string; label: string };

/** Filtro case-insensitive por subcadena sobre label y value. Puro para tests. */
export function filterComboboxOptions(
  options: ComboboxOption[],
  query: string,
): ComboboxOption[] {
  const q = query.trim().toLowerCase();
  if (!q) return options;
  return options.filter(
    (option) =>
      option.label.toLowerCase().includes(q) ||
      option.value.toLowerCase().includes(q),
  );
}

/**
 * Select con búsqueda: dispara un popover con input filtrable y navegación
 * por teclado (↑↓ Home End Enter Esc). El valor viaja en un input hidden, así
 * que funciona con forms nativos + useActionState igual que el resto del
 * panel. Vacío ("") = sin selección (los parsers de lib/forms.ts ya lo tratan
 * como null, sin necesidad del centinela NONE_VALUE).
 */
export function ComboboxField({
  id,
  name,
  options,
  value: controlledValue,
  defaultValue = "",
  onValueChange,
  placeholder,
  disabled = false,
  allowClear = false,
  className,
}: {
  id?: string;
  name: string;
  options: ComboboxOption[];
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  allowClear?: boolean;
  className?: string;
}) {
  const t = useTranslations("Forms");
  const [uncontrolled, setUncontrolled] = React.useState(defaultValue);
  const selected =
    controlledValue !== undefined ? controlledValue : uncontrolled;
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [highlighted, setHighlighted] = React.useState(0);
  const listRef = React.useRef<HTMLDivElement>(null);
  const listId = React.useId();

  const filtered = React.useMemo(
    () => filterComboboxOptions(options, query),
    [options, query],
  );

  // Índice resaltado saneado: la lista filtrada puede encoger y el índice
  // crudo quedarse fuera de rango (derivado en render, sin effect).
  const active = Math.min(highlighted, Math.max(filtered.length - 1, 0));

  React.useEffect(() => {
    if (!open) return;
    const node = listRef.current?.querySelector(`[data-index="${active}"]`);
    // jsdom no implementa scrollIntoView; la llamada opcional evita el crash.
    node?.scrollIntoView?.({ block: "nearest" });
  }, [active, open]);

  function commit(next: string) {
    if (controlledValue === undefined) setUncontrolled(next);
    onValueChange?.(next);
    setOpen(false);
  }

  function handleOpenChange(nextOpen: boolean) {
    if (nextOpen) {
      // Reset del filtro al abrir (equivalente a montar el contenido de nuevo).
      setQuery("");
      setHighlighted(0);
    }
    setOpen(nextOpen);
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setHighlighted((current) =>
        filtered.length ? (current + 1) % filtered.length : 0,
      );
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setHighlighted((current) =>
        filtered.length
          ? (current - 1 + filtered.length) % filtered.length
          : 0,
      );
    } else if (event.key === "Home") {
      event.preventDefault();
      setHighlighted(0);
    } else if (event.key === "End") {
      event.preventDefault();
      setHighlighted(Math.max(filtered.length - 1, 0));
    } else if (event.key === "Enter") {
      // preventDefault: Enter no debe enviar el form nativo que lo contiene.
      event.preventDefault();
      const option = filtered[active];
      if (option) commit(option.value);
    }
  }

  const selectedOption = options.find((option) => option.value === selected);

  return (
    <PopoverPrimitive.Root open={open} onOpenChange={handleOpenChange}>
      <input type="hidden" name={name} value={selected} />
      <PopoverPrimitive.Trigger
        id={id}
        type="button"
        disabled={disabled}
        className={cn(
          "flex h-8 w-full items-center justify-between gap-1.5 rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm whitespace-nowrap transition-colors outline-none select-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 dark:bg-input/30 dark:hover:bg-input/50",
          className,
        )}
      >
        <span className="truncate">
          {selectedOption ? (
            selectedOption.label
          ) : (
            <span className="text-muted-foreground">{placeholder}</span>
          )}
        </span>
        {allowClear && selectedOption && (
          <span
            role="button"
            tabIndex={-1}
            aria-label={t("comboboxClear")}
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              commit("");
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                event.stopPropagation();
                commit("");
              }
            }}
            className="rounded-sm p-0.5 opacity-70 transition-opacity hover:opacity-100"
          >
            <XIcon className="size-3.5" />
          </span>
        )}
        <ChevronDownIcon className="pointer-events-none size-4 shrink-0 text-muted-foreground" />
      </PopoverPrimitive.Trigger>
      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Content
          align="start"
          sideOffset={4}
          className="z-50 w-(--radix-popover-trigger-width) rounded-lg bg-popover p-1 text-popover-foreground shadow-md ring-1 ring-foreground/10 duration-100 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95"
        >
          <input
            autoFocus
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setHighlighted(0);
            }}
            onKeyDown={onKeyDown}
            placeholder={t("comboboxSearch")}
            role="combobox"
            aria-expanded={open}
            aria-controls={listId}
            aria-activedescendant={
              filtered.length > 0 ? `${listId}-option-${active}` : undefined
            }
            className="h-8 w-full rounded-md border border-input bg-transparent px-2.5 text-sm outline-none placeholder:text-muted-foreground focus-visible:border-ring"
          />
          <div
            ref={listRef}
            id={listId}
            role="listbox"
            className="mt-1 max-h-64 overflow-y-auto"
          >
            {filtered.map((option, index) => (
              <button
                key={option.value}
                type="button"
                role="option"
                id={`${listId}-option-${index}`}
                data-index={index}
                aria-selected={option.value === selected}
                onMouseMove={() => setHighlighted(index)}
                onClick={() => commit(option.value)}
                className={cn(
                  "flex w-full cursor-default items-center gap-1.5 rounded-md px-2 py-1.5 text-left text-sm outline-none",
                  index === active && "bg-accent text-accent-foreground",
                )}
              >
                <CheckIcon
                  className={cn(
                    "size-3.5 shrink-0",
                    option.value === selected ? "opacity-100" : "opacity-0",
                  )}
                />
                <span className="truncate">{option.label}</span>
              </button>
            ))}
            {filtered.length === 0 && (
              <p className="px-2 py-4 text-center text-sm text-muted-foreground">
                {t("comboboxEmpty")}
              </p>
            )}
          </div>
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  );
}
