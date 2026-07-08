import { chromium } from "playwright";

const BASE_URL = "http://localhost:3000";
const USER1_EMAIL = process.env.USER1_EMAIL || "usuario1@test.local";
const USER1_PASSWORD = process.env.USER1_PASSWORD || "usuario1";

async function verifyDetailPages() {
  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    console.log("🔐 Iniciando sesión...");
    await page.goto(`${BASE_URL}/login`, { waitUntil: "networkidle" });

    await page.fill('input[type="email"]', USER1_EMAIL);
    await page.fill('input[type="password"]', USER1_PASSWORD);
    await page.click('button[type="submit"]');

    await page.waitForURL(`${BASE_URL}/`, { timeout: 10000 });
    console.log("✅ Sesión iniciada");

    // Verificar página de pedidos
    console.log("\n📋 Visitando pedidos...");
    await page.goto(`${BASE_URL}/dashboard/pedidos`, { waitUntil: "networkidle" });
    await page.screenshot({ path: "screenshots/01-pedidos-lista.png" });
    console.log("✅ Captura: pedidos lista");

    const orderViewButton = page.locator('a[aria-label="Ver"]').first();
    if (await orderViewButton.isVisible()) {
      const orderLink = await orderViewButton.getAttribute("href");
      if (orderLink) {
        console.log(`📍 Abriendo primer pedido: ${orderLink}`);
        await page.goto(`${BASE_URL}${orderLink}`, { waitUntil: "networkidle" });
        await page.screenshot({ path: "screenshots/02-pedidos-detalle.png" });
        console.log("✅ Captura: pedidos detalle");
      }
    } else {
      console.log("⚠️  No hay botón de ver en pedidos (quizá la lista está vacía)");
    }

    // Verificar página de gastos
    console.log("\n💰 Visitando gastos...");
    await page.goto(`${BASE_URL}/dashboard/gastos`, { waitUntil: "networkidle" });
    await page.screenshot({ path: "screenshots/03-gastos-lista.png" });
    console.log("✅ Captura: gastos lista");

    const expenseViewButton = page.locator('a[aria-label="Ver"]').first();
    if (await expenseViewButton.isVisible()) {
      const expenseLink = await expenseViewButton.getAttribute("href");
      if (expenseLink) {
        console.log(`📍 Abriendo primer gasto: ${expenseLink}`);
        await page.goto(`${BASE_URL}${expenseLink}`, { waitUntil: "networkidle" });
        await page.screenshot({ path: "screenshots/04-gastos-detalle.png" });
        console.log("✅ Captura: gastos detalle");
      }
    } else {
      console.log("⚠️  No hay botón de ver en gastos (quizá la lista está vacía)");
    }

    // Verificar página de materiales
    console.log("\n🧶 Visitando materiales...");
    await page.goto(`${BASE_URL}/dashboard/materiales`, { waitUntil: "networkidle" });
    await page.screenshot({ path: "screenshots/05-materiales-lista.png" });
    console.log("✅ Captura: materiales lista");

    const materialViewButton = page.locator('a[aria-label="Ver"]').first();
    if (await materialViewButton.isVisible()) {
      const materialLink = await materialViewButton.getAttribute("href");
      if (materialLink) {
        console.log(`📍 Abriendo primer material: ${materialLink}`);
        await page.goto(`${BASE_URL}${materialLink}`, { waitUntil: "networkidle" });
        await page.screenshot({ path: "screenshots/06-materiales-detalle.png" });
        console.log("✅ Captura: materiales detalle");
      }
    } else {
      console.log("⚠️  No hay botón de ver en materiales (quizá la lista está vacía)");
    }

    console.log("\n✨ Verificación completada. Capturas guardadas en /screenshots");
  } catch (error) {
    console.error("❌ Error:", error);
    await page.screenshot({ path: "screenshots/error.png" });
  } finally {
    await browser.close();
  }
}

verifyDetailPages().catch(console.error);
