import { chromium } from "playwright";

const CONTRACT = "CC7CCIMTME2KBV7RRUTXAW6XTPE2FBRYLV3CLKF2YQNU5NHX5NYH37TC";
const ADMIN = "GBHBOPW5AMW5J6RRR4YU2NLJI3HRX7SG4Q4ZZBJILLDR3644INLHMMZZ";

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });

await page.goto(`https://stellar.expert/explorer/testnet/contract/${CONTRACT}`, { waitUntil: "networkidle" });
await page.waitForTimeout(2000);
await page.screenshot({ path: "public/contract-screenshot.png", fullPage: true });
console.log("Contract screenshot saved");

await page.goto(`https://stellar.expert/explorer/testnet/account/${ADMIN}`, { waitUntil: "networkidle" });
await page.waitForTimeout(2000);
await page.screenshot({ path: "public/account-screenshot.png", fullPage: true });
console.log("Account screenshot saved");

await browser.close();
