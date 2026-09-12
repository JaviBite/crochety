"use client";

import { Ellipsis, Eye, Pencil, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, useTransition, type ReactNode } from "react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Link } from "@/i18n/navigation";

type DeleteResult = { error?: string } | undefined | void;

/** Contenido del diálogo de borrado, controlado (lo comparten desktop y móvil). */
function DeleteConfirm({
  action,
  open,
  onOpenChange,
  entityName,
}: {
  action: () => Promise<DeleteResult>;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entityName?: string;
}) {
  const t = useTranslations("Forms");
  const [pending, startTransition] = useTransition();

  function onConfirm() {
    startTransition(async () => {
      const result = await action();
      if (result && "error" in result && result.error) {
        toast.error(result.error);
        return;
      }
      toast.success(
        entityName
          ? t("deletedNamed", { name: entityName })
          : t("deleted"),
      );
      onOpenChange(false);
    });
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {entityName
              ? t("deleteConfirmTitleNamed", { name: entityName })
              : t("deleteConfirmTitle")}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {t("deleteConfirmDescription")}
          </AlertDialogDescription>
        </AlertDialogHeader>
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

  return (
    <>
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label={t("delete")}
        className="text-muted-foreground hover:text-destructive"
        onClick={() => setOpen(true)}
      >
        <Trash2 />
      </Button>
      <DeleteConfirm action={action} open={open} onOpenChange={setOpen} />
    </>
  );
}

/** Icono con tooltip (desktop): el tooltip también sale con foco de teclado. */
function IconWithTooltip({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

/** Editar/Ver/Borrar para una fila/tarjeta de listado.
    Desktop: iconos con tooltip. Móvil: menú ⋯ para ganar espacio en la fila.
    Con `entityName` el diálogo y el toast nombran la entidad borrada. */
export function RowActions({
  viewHref,
  editHref,
  deleteAction,
  entityName,
}: {
  viewHref?: string;
  editHref: string;
  deleteAction: () => Promise<DeleteResult>;
  /** Nombre de la entidad para la confirmación ("¿Borrar "Pulpo"?"). */
  entityName?: string;
}) {
  const t = useTranslations("Forms");
  const [confirmOpen, setConfirmOpen] = useState(false);

  return (
    <>
      {/* Escritorio */}
      <TooltipProvider delayDuration={250}>
        <div className="hidden items-center justify-end gap-0.5 sm:flex">
          {viewHref && (
            <IconWithTooltip label={t("view")}>
              <Button
                asChild
                variant="ghost"
                size="icon-sm"
                aria-label={t("view")}
                className="text-muted-foreground hover:text-foreground"
              >
                <Link href={viewHref}>
                  <Eye />
                </Link>
              </Button>
            </IconWithTooltip>
          )}
          <IconWithTooltip label={t("edit")}>
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
          </IconWithTooltip>
          <IconWithTooltip label={t("delete")}>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={t("delete")}
              className="text-muted-foreground hover:text-destructive"
              onClick={() => setConfirmOpen(true)}
            >
              <Trash2 />
            </Button>
          </IconWithTooltip>
        </div>
      </TooltipProvider>

      {/* Móvil */}
      <div className="sm:hidden">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={t("rowActions")}
              className="text-muted-foreground hover:text-foreground"
            >
              <Ellipsis />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {viewHref && (
              <DropdownMenuItem asChild>
                <Link href={viewHref}>
                  <Eye />
                  {t("view")}
                </Link>
              </DropdownMenuItem>
            )}
            <DropdownMenuItem asChild>
              <Link href={editHref}>
                <Pencil />
                {t("edit")}
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem
              variant="destructive"
              onClick={() => setConfirmOpen(true)}
            >
              <Trash2 />
              {t("delete")}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <DeleteConfirm
        action={deleteAction}
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        entityName={entityName}
      />
    </>
  );
}
