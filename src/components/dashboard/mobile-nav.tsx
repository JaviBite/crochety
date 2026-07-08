"use client";

import { Menu } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { DashboardNav } from "./nav";

export function MobileNav({
  brand,
  isAdmin = false,
}: {
  brand: string;
  isAdmin?: boolean;
}) {
  const t = useTranslations("Nav");
  const [open, setOpen] = useState(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" aria-label={t("openMenu")}>
          <Menu className="size-5" />
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-64 p-4">
        <SheetHeader className="p-0 pb-4">
          <SheetTitle>🧶 {brand}</SheetTitle>
        </SheetHeader>
        <DashboardNav isAdmin={isAdmin} onNavigate={() => setOpen(false)} />
      </SheetContent>
    </Sheet>
  );
}
