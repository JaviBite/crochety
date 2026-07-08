import { getTranslations } from "next-intl/server";
import { Badge } from "@/components/ui/badge";
import { Link } from "@/i18n/navigation";

/**
 * Barra de filtro por etiqueta para un listado. Cada chip es un enlace que
 * añade `?tag=<nombre>` a la ruta; el chip "Todas" limpia el filtro. Se apoya
 * en el render de servidor: la página lee `searchParams.tag` y filtra la query.
 */
/** Parámetros a conservar en los enlaces, descartando los vacíos. */
function keepQuery(
  preserve: Record<string, string | undefined>,
): Record<string, string> {
  return Object.fromEntries(
    Object.entries(preserve).filter(([, value]) => value),
  ) as Record<string, string>;
}

export async function TagFilter({
  tags,
  activeTag,
  basePath,
  preserveQuery = {},
}: {
  tags: string[];
  activeTag?: string;
  basePath: string;
  /** Otros filtros activos (q, color) que los chips no deben perder. */
  preserveQuery?: Record<string, string | undefined>;
}) {
  if (tags.length === 0) return null;
  const tForms = await getTranslations("Forms");
  const base = keepQuery(preserveQuery);

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <Link href={{ pathname: basePath, query: base }}>
        <Badge
          variant={activeTag ? "outline" : "default"}
          className="cursor-pointer"
        >
          {tForms("tagFilterAll")}
        </Badge>
      </Link>
      {tags.map((tag) => {
        const active = activeTag === tag;
        return (
          <Link
            key={tag}
            href={{ pathname: basePath, query: { ...base, tag } }}
          >
            <Badge
              variant={active ? "default" : "outline"}
              className="cursor-pointer"
            >
              {tag}
            </Badge>
          </Link>
        );
      })}
    </div>
  );
}

/** Chips de las etiquetas de un elemento; cada uno enlaza a su filtro. */
export function TagChips({
  tags,
  basePath,
}: {
  tags: { name: string }[];
  basePath: string;
}) {
  if (tags.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-1">
      {tags.map((tag) => (
        <Link
          key={tag.name}
          href={{ pathname: basePath, query: { tag: tag.name } }}
        >
          <Badge variant="secondary" className="cursor-pointer">
            {tag.name}
          </Badge>
        </Link>
      ))}
    </div>
  );
}
