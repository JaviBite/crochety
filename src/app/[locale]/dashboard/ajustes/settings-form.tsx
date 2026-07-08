"use client";

import { useTranslations } from "next-intl";
import { useActionState, useState } from "react";
import { SubmitButton } from "@/components/form/submit-button";
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
import { AI_PROVIDERS, type AiProvider } from "@/lib/validations";
import { updateSettings } from "./actions";

// Nombres de marca, no se traducen.
const PROVIDER_LABELS: Record<AiProvider, string> = {
  anthropic: "Anthropic",
  openai: "OpenAI",
  openrouter: "OpenRouter",
  ollama: "Ollama (local)",
};

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
              <Input
                id="aiModel"
                name="aiModel"
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
