import { chromium } from "playwright";
import { Keypair } from "@stellar/stellar-sdk";

const BASE = process.env.BASE_URL || "https://agri-con-one.vercel.app";
const COUNT = parseInt(process.env.COUNT || "10", 10);

async function createFarmer(page, i) {
  const kp = Keypair.random();
  const addr = kp.publicKey();

  // Fund via friendbot
  const fb = await fetch(`https://friendbot.stellar.org?addr=${addr}`);
  if (!fb.ok) { console.error(`  friendbot failed for ${addr}`); return null; }

  // Create profile via API
  const res = await page.request.post(`${BASE}/api/profile`, {
    data: {
      address: addr,
      fullName: `Farm ${i} Owner`,
      farmName: `Green Farm ${i}`,
      region: ["Nueva Ecija", "Pangasinan", "Isabela", "Cagayan", "Bulacan"][i % 5],
      totalYieldKg: 1000 + (i * 500),
    },
  });
  if (!res.ok()) { console.error(`  profile creation failed for ${addr}`); return null; }
  const body = await res.json();
  return { addr, verified: body.profile?.verified, ...body.profile };
}

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext();
const page = await context.newPage();

console.log(`Seeding ${COUNT} farms to ${BASE}...\n`);

const farms = [];
for (let i = 1; i <= COUNT; i++) {
  process.stdout.write(`  [${i}/${COUNT}] Creating farm...`);
  const farm = await createFarmer(page, i);
  if (farm) {
    farms.push(farm);
    process.stdout.write(` ✅ ${farm.addr.slice(0, 8)} verified=${farm.verified}\n`);
  } else {
    process.stdout.write(` ❌\n`);
  }
}

console.log(`\nDone. ${farms.length}/${COUNT} farms created successfully.`);

// Quick verification
const check = await page.request.get(`${BASE}/api/profile?address=${farms[0]?.addr}`);
const checkBody = await check.json();
console.log(`Sample check: ${farms[0]?.addr?.slice(0, 8)} verified=${checkBody.profile?.verified}`);

await browser.close();
