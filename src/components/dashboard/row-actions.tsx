"use client";

import { Pencil, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";

type DeleteResult = { error?: string } | undefined | void;

/**
 * Botón de borrado con confirmación. `action` es una server action ya ligada al
 * id (page hace `deleteX.bind(null, id)`), así que aquí basta con invocarla.
 */
export function DeleteButton({
  action,
}: {
  action: () => Promise<DeleteResult>;
}) {
  const t = useTranslations("Forms");
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function onConfirm() {
    setError(null);
    startTransition(async () => {
      const result = await action();
      if (result && "error" in result && result.error) {
        setError(result.error);
        return;
      }
      setOpen(false);
    });
  }

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={t("delete")}
          className="text-muted-foreground hover:text-destructive"
        >
          <Trash2 />
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t("deleteConfirmTitle")}</AlertDialogTitle>
          <AlertDialogDescription>
            {t("deleteConfirmDescription")}
          </AlertDialogDescription>
        </AlertDialogHeader>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>{t("cancel")}</AlertDialogCancel>
          <Button variant="destructive" onClick={onConfirm} disabled={pending}>
            {pending ? t("deleting") : t("deleteConfirmAction")}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

/** Editar (enlace) + Borrar (con confirmación) para una fila/tarjeta de listado. */
export function RowActions({
  editHref,
  deleteAction,
}: {
  editHref: string;
  deleteAction: () => Promise<DeleteResult>;
}) {
  const t = useTranslations("Forms");
  return (
    <div className="flex items-center justify-end gap-0.5">
      <Button
        asChild
        variant="ghost"
        size="icon-sm"
        aria-label={t("edit")}
        className="text-muted-foreground hover:text-foreground"
      >
        <Link href={editHref}>
          <Pencil />
        </Link>
      </Button>
      <DeleteButton action={deleteAction} />
    </div>
  );
}
