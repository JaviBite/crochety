// Cambia/restaura temporalmente el modelo de IA en BD para pruebas.
// Uso: npx tsx --conditions=react-server scratchpad/switch-model.mts set <model>
//      npx tsx --conditions=react-server scratchpad/switch-model.mts restore <modelAnterior>
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env" });
const { prisma } = await import("../src/lib/prisma");

const [, , action, value] = process.argv;
if (action === "set") {
  await prisma.setting.upsert({
    where: { key: "aiModel" },
    update: { value: value! },
    create: { key: "aiModel", value: value! },
  });
  console.log("aiModel →", value);
} else if (action === "restore") {
  await prisma.setting.update({
    where: { key: "aiModel" },
    data: { value: value! },
  });
  console.log("aiModel restaurado →", value);
} else {
  console.error('uso: set <model> | restore <model>');
  process.exit(1);
}
