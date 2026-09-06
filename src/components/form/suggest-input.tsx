"use client";

import * as React from "react";
import { useId } from "react";
import { Input } from "@/components/ui/input";

/**
 * Input de texto con sugerencias nativas (`<datalist>`) a partir de `options`.
 * Sigue siendo texto libre: el servidor valida/normaliza igual que sin
 * sugerencias, así que es seguro añadirlo a formularios existentes sin tocar
 * parsers.
 */
export function SuggestInput({
  options = [],
  ...props
}: React.ComponentProps<"input"> & { options?: string[] }) {
  const listId = useId();
  return (
    <>
      <Input list={options.length > 0 ? listId : undefined} {...props} />
      {options.length > 0 && (
        <datalist id={listId}>
          {options.map((option) => (
            <option key={option} value={option} />
          ))}
        </datalist>
      )}
    </>
  );
}
