"use client";

import { X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useActionState, useState } from "react";
import { SubmitButton } from "@/components/form/submit-button";
import { SuggestInput } from "@/components/form/suggest-input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { SettingsSnapshot } from "@/lib/settings";
import { ACCENTS } from "@/lib/theme";
import {
  AI_PROVIDERS,
  SUGGESTED_AI_MODELS,
  type AiProvider,
} from "@/lib/validations";
import { updateSettings } from "./actions";

// Nombres de marca, no se traducen.
const PROVIDER_LABELS: Record<AiProvider, string> = {
  anthropic: "Anthropic",
  openai: "OpenAI",
  openrouter: "OpenRouter",
  ollama: "Ollama (local)",
};

/**
 * Editor de ubicaciones de materiales (chips añadir/quitar). Viaja en un
 * hidden input JSON; el servidor lo parsea de forma tolerante
 * (parseLocationsJson) y lo guarda en el Setting `locations`.
 */
function LocationsEditor({ initial }: { initial: string[] }) {
  const t = useTranslations("Settings");
  const [locations, setLocations] = useState<string[]>(initial);
  const [draft, setDraft] = useState("");

  function add() {
    const value = draft.trim().slice(0, 60);
    setDraft("");
    if (!value) return;
    setLocations((current) =>
      current.includes(value) ? current : [...current, value],
    );
  }

  return (
    <div className="space-y-2">
      <Label htmlFor="locationDraft">{t("fieldLocations")}</Label>
      <input type="hidden" name="locations" value={JSON.stringify(locations)} />
      {locations.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {locations.map((location) => (
            <Badge key={location} variant="secondary" className="gap-1 pr-1">
              {location}
              <button
                type="button"
                onClick={() =>
                  setLocations((current) =>
                    current.filter((value) => value !== location),
                  )
                }
                aria-label={t("locationRemove", { location })}
                className="rounded-full opacity-70 transition-opacity hover:opacity-100"
              >
                <X className="size-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}
      <div className="flex gap-2">
        <Input
          id="locationDraft"
          value={draft}
          maxLength={60}
          placeholder={t("locationAddPlaceholder")}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              add();
            }
          }}
          className="flex-1"
        />
        <Button type="button" variant="outline" onClick={add}>
          {t("locationAdd")}
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">{t("locationsHint")}</p>
    </div>
  );
}

export function SettingsForm({ snapshot }: { snapshot: SettingsSnapshot }) {
  const t = useTranslations("Settings");
  const tTheme = useTranslations("Theme");
  const [state, formAction] = useActionState(updateSettings, null);

  // El proveedor elegido decide qué campos de IA se muestran (clave/URL).
  const [provider, setProvider] = useState<AiProvider>(snapshot.aiProvider);
  const keySource =
    provider === "ollama" ? null : snapshot.apiKeySource[provider];

  return (
    <form action={formAction} className="max-w-2xl space-y-6">
      <Card className="rounded-2xl shadow-sm">
        <CardHeader>
          <CardTitle className="text-base">{t("workshopTitle")}</CardTitle>
          <CardDescription>{t("workshopDescription")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="workshopName">{t("fieldWorkshopName")}</Label>
            <Input
              id="workshopName"
              name="workshopName"
              maxLength={60}
              defaultValue={snapshot.workshopName}
              placeholder="Zgz Stitches"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="workshopTagline">{t("fieldWorkshopTagline")}</Label>
            <Input
              id="workshopTagline"
              name="workshopTagline"
              maxLength={140}
              defaultValue={snapshot.workshopTagline}
              placeholder={t("taglinePlaceholder")}
            />
            <p className="text-xs text-muted-foreground">{t("taglineHint")}</p>
          </div>
          <div className="flex items-start gap-3 rounded-xl border p-4">
            <Checkbox
              id="galleryEnabled"
              name="galleryEnabled"
              className="mt-0.5"
              defaultChecked={snapshot.galleryEnabled}
            />
            <div className="space-y-1">
              <Label htmlFor="galleryEnabled">{t("fieldGalleryEnabled")}</Label>
              <p className="text-sm text-muted-foreground">
                {t("galleryEnabledHint")}
              </p>
            </div>
          </div>
          <LocationsEditor initial={snapshot.locations} />
        </CardContent>
      </Card>

      <Card className="rounded-2xl shadow-sm">
        <CardHeader>
          <CardTitle className="text-base">{t("appearanceTitle")}</CardTitle>
          <CardDescription>{t("appearanceDescription")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="defaultAccent">{t("fieldDefaultAccent")}</Label>
            <Select name="defaultAccent" defaultValue={snapshot.defaultAccent}>
              <SelectTrigger id="defaultAccent" className="w-full sm:w-60">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ACCENTS.map((accent) => (
                  <SelectItem key={accent} value={accent}>
                    {tTheme(accent)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              {t("defaultAccentHint")}
            </p>
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-2xl shadow-sm">
        <CardHeader>
          <CardTitle className="text-base">{t("aiTitle")}</CardTitle>
          <CardDescription>{t("aiDescription")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="aiProvider">{t("fieldAiProvider")}</Label>
              <Select
                name="aiProvider"
                value={provider}
                onValueChange={(value) => setProvider(value as AiProvider)}
              >
                <SelectTrigger id="aiProvider" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {AI_PROVIDERS.map((value) => (
                    <SelectItem key={value} value={value}>
                      {PROVIDER_LABELS[value]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="aiModel">{t("fieldAiModel")}</Label>
              <SuggestInput
                id="aiModel"
                name="aiModel"
                options={SUGGESTED_AI_MODELS[provider]}
                defaultValue={snapshot.aiModel}
                placeholder={snapshot.defaultModel[provider]}
              />
            </div>
          </div>

          {provider === "ollama" ? (
            <div className="space-y-2">
              <Label htmlFor="ollamaBaseUrl">{t("fieldOllamaBaseUrl")}</Label>
              <Input
                id="ollamaBaseUrl"
                name="ollamaBaseUrl"
                type="url"
                defaultValue={snapshot.ollamaBaseUrl}
                placeholder="http://localhost:11434/v1"
              />
            </div>
          ) : (
            <div className="space-y-2">
              <Label htmlFor="apiKey">
                {t("fieldApiKey", { provider: PROVIDER_LABELS[provider] })}
              </Label>
              <Input
                id="apiKey"
                name="apiKey"
                type="password"
                autoComplete="off"
                placeholder={
                  keySource ? "••••••••••••" : t("apiKeyPlaceholder")
                }
              />
              <p className="text-xs text-muted-foreground">
                {keySource === "db"
                  ? t("apiKeyFromDb")
                  : keySource === "env"
                    ? t("apiKeyFromEnv")
                    : t("apiKeyMissing")}
              </p>
              {keySource === "db" && (
                <div className="flex items-center gap-2 pt-1">
                  <Checkbox id="clearApiKey" name="clearApiKey" />
                  <Label
                    htmlFor="clearApiKey"
                    className="text-sm font-normal text-muted-foreground"
                  >
                    {t("clearApiKey")}
                  </Label>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {state != null && "error" in state && (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      )}
      {state != null && "success" in state && (
        <p role="status" className="text-sm text-primary">
          {t("saved")}
        </p>
      )}

      <SubmitButton />
    </form>
  );
}
