import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import { OrderForm } from "../../order-form";

export default async function EditOrderPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [t, order, users, patterns, materials] = await Promise.all([
    getTranslations("Orders"),
    prisma.order.findUnique({
      where: { id },
      include: {
        photos: { where: { isCover: true }, take: 1, select: { path: true } },
        materials: { select: { materialId: true, quantity: true } },
      },
    }),
    prisma.user.findMany({
      select: { id: true, name: true },
      orderBy: { createdAt: "asc" },
    }),
    prisma.pattern.findMany({
      select: { id: true, title: true },
      orderBy: { title: "asc" },
    }),
    prisma.material.findMany({
      select: { id: true, name: true, priceCents: true },
      orderBy: { name: "asc" },
    }),
  ]);

  if (!order) notFound();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t("editTitle")}</h1>
        <p className="text-muted-foreground">{t("editDescription")}</p>
      </div>
      <OrderForm
        users={users}
        patterns={patterns}
        materials={materials}
        order={{
          id: order.id,
          name: order.name,
          description: order.description,
          quantity: order.quantity,
          priceCents: order.priceCents,
          status: order.status,
          customer: order.customer,
          assignedToId: order.assignedToId,
          patternId: order.patternId,
          dueDate: order.dueDate,
          isPublic: order.isPublic,
          coverPhotoPath: order.photos[0]?.path ?? null,
          materials: order.materials,
        }}
      />
    </div>
  );
}
