import { getTranslations } from "next-intl/server";
import { MaterialForm } from "../material-form";

export default async function NewMaterialPage() {
  const t = await getTranslations("Materials");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t("newTitle")}</h1>
        <p className="text-muted-foreground">{t("newDescription")}</p>
      </div>
      <MaterialForm />
    </div>
  );
}
