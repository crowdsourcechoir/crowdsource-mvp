import { chromium, devices } from "playwright";
import { mkdirSync } from "fs";

const url = process.argv[2] ?? "http://localhost:3000/e/csc-apr1?panel=songgarden";
const outDir = ".tmp/mobile-layout";
mkdirSync(outDir, { recursive: true });

const iPhone = devices["iPhone 13"];

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({
  ...iPhone,
  locale: "en-US",
});

await page.goto(url, { waitUntil: "networkidle", timeout: 60000 });
await page.waitForTimeout(3500);

const metrics = await page.evaluate(() => {
  const doc = document.documentElement;
  const body = document.body;
  const overflowX = Math.max(doc.scrollWidth, body.scrollWidth) - window.innerWidth;
  const sections = [...document.querySelectorAll("section")].map((el, i) => {
    const r = el.getBoundingClientRect();
    return { i, top: Math.round(r.top), height: Math.round(r.height), width: Math.round(r.width) };
  });
  const buttons = [...document.querySelectorAll("button")].slice(0, 12).map((el) => {
    const r = el.getBoundingClientRect();
    const text = el.textContent?.trim().replace(/\s+/g, " ").slice(0, 40);
    return {
      text,
      w: Math.round(r.width),
      h: Math.round(r.height),
      tooSmall: r.height < 44 || r.width < 44,
    };
  });
  const intro = document.querySelector("p .animate-pulse")?.parentElement?.textContent?.trim();
  return {
    viewport: { w: window.innerWidth, h: window.innerHeight },
    scroll: { w: doc.scrollWidth, h: doc.scrollHeight },
    overflowX,
    sections,
    buttons,
    intro: intro?.slice(0, 80),
  };
});

await page.screenshot({ path: `${outDir}/iphone-top.png`, fullPage: false });
await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
await page.waitForTimeout(300);
await page.screenshot({ path: `${outDir}/iphone-bottom.png`, fullPage: false });
await page.screenshot({ path: `${outDir}/iphone-full.png`, fullPage: true });

console.log(JSON.stringify(metrics, null, 2));
await browser.close();
