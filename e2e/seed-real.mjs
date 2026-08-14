import { Keypair } from "@stellar/stellar-sdk";

const BASE = process.env.BASE_URL || "https://agri-con-one.vercel.app";

const FARMS = [
  { fullName: "Maria Concepcion Santos", farmName: "Hacienda de Santa Maria", region: "Nueva Ecija", totalYieldKg: 12000, crop: "rice", quantityKg: 8000, priceXlm: 3500, areaHa: 8 },
  { fullName: "Eduardo Reyes III", farmName: "Green Valley Agriventures", region: "Pangasinan", totalYieldKg: 15000, crop: "rice", quantityKg: 10000, priceXlm: 4200, areaHa: 10 },
  { fullName: "Catherine D. Mercado", farmName: "Mercado Family Organic Farm", region: "Isabela", totalYieldKg: 8000, crop: "corn", quantityKg: 6000, priceXlm: 2800, areaHa: 6 },
  { fullName: "Roberto L. Navarro", farmName: "Navarro Rice & Grain", region: "Cagayan", totalYieldKg: 20000, crop: "rice", quantityKg: 15000, priceXlm: 6000, areaHa: 15 },
  { fullName: "Jennifer A. Garcia", farmName: "Garcia Sustainable Crops", region: "Bulacan", totalYieldKg: 6000, crop: "vegetables", quantityKg: 4000, priceXlm: 2200, areaHa: 4 },
  { fullName: "Antonio B. Villanueva", farmName: "Villanueva Rice Terraces", region: "Ifugao", totalYieldKg: 5000, crop: "rice", quantityKg: 3500, priceXlm: 1800, areaHa: 3 },
];

const nftIdStart = 100;

async function createFarmer(i) {
  const kp = Keypair.random();
  const addr = kp.publicKey();
  const farm = FARMS[i];

  // Fund via friendbot
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const fb = await fetch(`https://friendbot.stellar.org?addr=${addr}`, { signal: AbortSignal.timeout(20000) });
      if (fb.ok) break;
    } catch {}
    await new Promise(r => setTimeout(r, 3000));
  }

  // Create profile
  const profileRes = await fetch(`${BASE}/api/profile`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      address: addr,
      fullName: farm.fullName,
      farmName: farm.farmName,
      region: farm.region,
      totalYieldKg: farm.totalYieldKg,
    }),
  });
  if (!profileRes.ok) {
    const err = await profileRes.text();
    console.error(`  ${farm.farmName} profile failed:`, err.slice(0, 100));
    return null;
  }
  const profile = await profileRes.json();
  console.log(`  ✅ ${farm.fullName} — ${farm.farmName} (verified: ${profile.profile?.verified})`);

  // Create listing
  const nftId = nftIdStart + i;
  const listingRes = await fetch(`${BASE}/api/listings`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      nftId,
      cropType: farm.crop,
      quantityKg: farm.quantityKg,
      priceXlm: farm.priceXlm,
      farmerId: addr,
      parcelName: `${farm.farmName} — Parcel ${String.fromCharCode(65 + i)}`,
      region: farm.region,
      buyable: true,
      areaHa: farm.areaHa,
      totalYieldKg: farm.totalYieldKg,
      status: "minted",
    }),
  });
  if (!listingRes.ok) {
    const err = await listingRes.text();
    console.error(`  ${farm.farmName} listing failed:`, err.slice(0, 100));
    return null;
  }
  console.log(`  📦 NFT #${nftId} — ${farm.quantityKg}kg ${farm.crop} at ${farm.priceXlm} XLM`);

  return { addr, ...farm, nftId };
}

console.log(`\n🌾 Seeding real farms to ${BASE}\n`);

const results = [];
for (let i = 0; i < FARMS.length; i++) {
  process.stdout.write(`[${i + 1}/${FARMS.length}] ${FARMS[i].farmName}...\n`);
  const r = await createFarmer(i);
  if (r) results.push(r);
}

console.log(`\n✅ ${results.length}/${FARMS.length} farms seeded\n`);

// Verify
const check = await fetch(`${BASE}/api/profile`);
const all = await check.json();
console.log(`Total farmers on platform: ${all.profiles?.length || 0}`);

const listingCheck = await fetch(`${BASE}/api/listings`);
const allListings = await listingCheck.json();
console.log(`Total listings on platform: ${allListings.listings?.length || 0}`);
console.log(`Buyable listings: ${allListings.listings?.filter(l => l.buyable)?.length || 0}`);
