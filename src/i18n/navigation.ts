import { createNavigation } from "next-intl/navigation";
import { routing } from "./routing";

// Wrappers de navegación conscientes del locale: usar SIEMPRE estos en lugar
// de los de next/link y next/navigation dentro de páginas localizadas.
export const { Link, redirect, usePathname, useRouter, getPathname } =
  createNavigation(routing);
