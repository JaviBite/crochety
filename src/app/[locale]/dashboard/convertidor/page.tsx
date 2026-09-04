import { getTranslations } from "next-intl/server";
import { ConvertidorForm } from "./convertidor-form";

export default async function ConvertidorPage() {
  const t = await getTranslations("Convertidor");
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t("title")}</h1>
        <p className="text-muted-foreground">{t("description")}</p>
      </div>
      <ConvertidorForm />
    </div>
  );
}
