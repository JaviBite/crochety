// Flujo completo local: login → convertidor (texto pegado) → convertir →
// guardar → verificar estado y navegación posterior (lista y detalle).
// Uso: node scratchpad/verify-convert-save.mjs  (dev server debe estar en :3000)
import { chromium } from "playwright";
import { config } from "dotenv";
config({ path: ".env" });

const base = "http://localhost:3000";
const TEXT = `Gato miniatura
Materiales: lana negra DK, aguja 2.5 mm, relleno
Abreviaturas: pb = punto bajo, aum = aumento, dism = disminución
Cabeza
R1: 6 pb en anillo mágico (6)
R2: aum x6 (12)
R3: (1 pb, aum) x6 (18)
Tip: usa un marcador de puntos para no perder la primera vuelta.
R4-R5: 18 pb (18)
Empieza a rellenar firmemente.
R6: (1 pb, dism) x6 (12)
R7: dism x6 (6)
Corta el hilo y cierra.
Cola
R1: 6 pb en anillo mágico (6)
R2-R4: 6 pb (6)
Montaje: cose la cola al cuerpo entre R3 y R4.`;

const browser = await chromium.launch();
const page = await browser.newPage();
const failures = [];
page.on("pageerror", (e) => failures.push(`pageerror: ${e.message}`));
page.on("console", (m) => {
  if (m.type() === "error") failures.push(`console: ${m.text().slice(0, 200)}`);
});

try {
  await page.goto(`${base}/login`, { waitUntil: "networkidle" });
  await page.fill("#email", process.env.USER1_EMAIL);
  await page.fill("#password", process.env.USER1_PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForURL("**/dashboard", { timeout: 30000 });
  console.log("login OK");

  await page.goto(`${base}/dashboard/convertidor`, { waitUntil: "networkidle" });
  await page.fill("#text", TEXT);
  await page.click('button[type="submit"]');
  // Progreso visible con pasos en vivo
  await page.waitForSelector("text=/Estandarizando|IA|Convirtiendo|patrón/", { timeout: 20000 });
  console.log("panel de progreso visible");
  // Resultados (la IA puede tardar hasta ~4 min en el modelo gratuito)
  await page.waitForSelector("text=Markdown", { timeout: 300000 });
  console.log("resultados visibles");
  await page.screenshot({ path: "scratchpad/shot-results.png", fullPage: true });

  await page.getByRole("button", { name: /^Guardar/ }).first().click();
  await page.waitForSelector("text=Guardado", { timeout: 30000 });
  console.log("patrón GUARDADO sin salir de resultados");
  await page.waitForTimeout(1500); // router.refresh
  await page.screenshot({ path: "scratchpad/shot-saved.png", fullPage: true });

  // "Ver en patrones" → detalle
  await page.getByRole("link", { name: /Ver en patrones/ }).first().click();
  await page.waitForLoadState("networkidle");
  console.log("URL detalle:", page.url());
  const h1 = await page.locator("h1").first().textContent();
  console.log("detalle h1:", h1?.trim());
  await page.screenshot({ path: "scratchpad/shot-detail.png", fullPage: true });

  // Listado con exportaciones
  await page.goto(`${base}/dashboard/patrones`, { waitUntil: "networkidle" });
  const exportCount = await page.locator('a[title="Markdown"]').count();
  console.log("links MD en el listado:", exportCount);
  await page.screenshot({ path: "scratchpad/shot-list.png", fullPage: true });
  console.log("FLUJO COMPLETO OK");
} catch (e) {
  console.log("FALLO:", e.message?.slice(0, 300));
  await page.screenshot({ path: "scratchpad/shot-fail.png", fullPage: true }).catch(() => {});
} finally {
  if (failures.length) {
    console.log("ERRORES DE CONSOLIDA/PÁGINA:");
    for (const f of failures.slice(0, 8)) console.log("  -", f);
  } else {
    console.log("sin errores de consola");
  }
  await browser.close();
}
