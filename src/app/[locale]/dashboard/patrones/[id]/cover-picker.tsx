"use client";

import { ImageIcon, LoaderCircle } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { loadCoverCandidates, setPatternCover } from "../actions";

/**
 * Selector de portada: al abrirlo extrae las imágenes del origen (PDF/web) y
 * las muestra en cuadrícula; al pulsar una se fija como portada del patrón.
 */
export function CoverPicker({ id }: { id: string }) {
  const t = useTranslations("Patterns");
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [candidates, setCandidates] = useState<string[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState<string | null>(null);
  const [loading, startLoading] = useTransition();

  function toggle() {
    if (open) {
      setOpen(false);
      return;
    }
    setOpen(true);
    setError(null);
    if (candidates) return; // ya cargadas en esta sesión
    startLoading(async () => {
      const result = await loadCoverCandidates(id);
      if ("error" in result) setError(result.error);
      else setCandidates(result.candidates);
    });
  }

  function choose(src: string) {
    setError(null);
    setSaving(src);
    startLoading(async () => {
      const result = await setPatternCover(id, src);
      setSaving(null);
      if (result && "error" in result) {
        setError(result.error);
        return;
      }
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <div className="space-y-3">
      <Button variant="outline" onClick={toggle}>
        <ImageIcon className="size-4" />
        {t("chooseCover")}
      </Button>

      {open && (
        <div className="rounded-2xl border p-4">
          {loading && !candidates ? (
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <LoaderCircle className="size-4 animate-spin" />
              {t("coverLoading")}
            </p>
          ) : error ? (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          ) : candidates && candidates.length > 0 ? (
            <>
              <p className="mb-3 text-sm text-muted-foreground">
                {t("coverHintPick")}
              </p>
              <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5">
                {candidates.map((src, index) => (
                  <button
                    key={index}
                    type="button"
                    onClick={() => choose(src)}
                    disabled={loading}
                    aria-label={t("coverSelectOne", { n: index + 1 })}
                    className="group relative aspect-square overflow-hidden rounded-lg border transition-colors hover:border-primary disabled:opacity-60"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={src}
                      alt=""
                      className="size-full object-cover transition-transform group-hover:scale-105"
                    />
                    {saving === src && (
                      <span className="absolute inset-0 flex items-center justify-center bg-background/60">
                        <LoaderCircle className="size-5 animate-spin" />
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">{t("coverEmpty")}</p>
          )}
        </div>
      )}
    </div>
  );
}
