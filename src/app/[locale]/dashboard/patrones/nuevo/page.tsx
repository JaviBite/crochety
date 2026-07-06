import { getTranslations } from "next-intl/server";
import { PatternForm } from "../pattern-form";

export default async function NewPatternPage() {
  const t = await getTranslations("Patterns");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t("newTitle")}</h1>
        <p className="text-muted-foreground">{t("newDescription")}</p>
      </div>
      <PatternForm />
    </div>
  );
}
