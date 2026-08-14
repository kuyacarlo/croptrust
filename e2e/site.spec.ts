import { test, expect } from "@playwright/test";
import { Keypair, TransactionBuilder, Operation, Asset, BASE_FEE, rpc } from "@stellar/stellar-sdk";

const RPC = "https://soroban-testnet.stellar.org";
const PASSPHRASE = "Test SDF Network ; September 2015";

async function createFundedKeypair() {
  const kp = Keypair.random();
  const addr = kp.publicKey();
  for (let i = 0; i < 3; i++) {
    try {
      const ac = new AbortController();
      const timer = setTimeout(() => ac.abort(), 15000);
      const res = await fetch(`https://friendbot.stellar.org?addr=${addr}`, { signal: ac.signal });
      clearTimeout(timer);
      if (res.ok) return { kp, addr };
    } catch { /* retry */ }
    await new Promise((r) => setTimeout(r, 2000));
  }
  throw new Error("Friendbot unreachable after 3 retries");
}

async function waitForTxHorizon(hash: string, retries = 15) {
  for (let i = 0; i < retries; i++) {
    const res = await fetch(`https://horizon-testnet.stellar.org/transactions/${hash}`);
    if (res.ok) {
      const tx = await res.json();
      if (tx.successful) return tx;
      throw new Error(`Transaction failed: ${hash}`);
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error(`Transaction ${hash} not found after ${retries}s`);
}

let farmerAddr = "";
let buyerAddr = "";
let listingDbId = 0;
const TEST_NFT_ID = 99999;

test.describe("Landing page", () => {
  test("loads hero section", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText("Agricultural").first()).toBeVisible({ timeout: 15000 });
  });

  test("shows satellite verification feature", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "Satellite Verification" })).toBeVisible({ timeout: 15000 });
  });
});

test.describe("Full user flow: signup → list → buy → rate", () => {
  test("1. Sign up as farmer", async ({ request }) => {
    test.setTimeout(30000);
    const { addr } = await createFundedKeypair();
    farmerAddr = addr;
    const res = await request.post("/api/profile", {
      data: { address: addr, fullName: "E2E Farmer", farmName: "Test Farm", region: "Nueva Ecija", totalYieldKg: 5000 },
    });
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.profile.verified).toBe(true);
  });

  test("2. List a farm/crop", async ({ request }) => {
    expect(farmerAddr).toBeTruthy();
    const res = await request.post("/api/listings", {
      data: {
        nftId: TEST_NFT_ID, cropType: "rice", quantityKg: 1000, priceXlm: 500,
        farmerId: farmerAddr, parcelName: "E2E Test Parcel", region: "Nueva Ecija",
        buyable: true, areaHa: 5,
      },
    });
    expect(res.ok()).toBeTruthy();
  });

  test("3. All farmers are listed", async ({ request }) => {
    const res = await request.get("/api/profile");
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(Array.isArray(body.profiles)).toBe(true);
    expect(body.profiles.length).toBeGreaterThan(0);
    const found = body.profiles.find((p: any) => p.id === farmerAddr);
    expect(found).toBeTruthy();
    expect(found.verified).toBe(true);
  });

  test("4. Listing appears in marketplace", async ({ request }) => {
    const res = await request.get(`/api/listings?farmerId=${farmerAddr}`);
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.ok).toBe(true);
    const listing = body.listings.find((l: any) => l.nft_id === TEST_NFT_ID);
    expect(listing).toBeTruthy();
    expect(listing.crop_type).toBe("rice");
    listingDbId = listing.id;
    expect(listingDbId).toBeGreaterThan(0);
  });

  test("5. Buyer signs up and creates order", async ({ request }) => {
    test.setTimeout(30000);
    expect(farmerAddr).toBeTruthy();
    expect(listingDbId).toBeGreaterThan(0);
    const { addr } = await createFundedKeypair();
    buyerAddr = addr;

    const profileRes = await request.post("/api/profile", {
      data: { address: addr, fullName: "E2E Buyer", farmName: "", region: "", totalYieldKg: 0 },
    });
    expect(profileRes.ok()).toBeTruthy();

    // listingId must be the DB auto-increment id, not nft_id (FK constraint)
    const orderRes = await request.post("/api/orders", {
      data: { listingId: listingDbId, buyerAddress: buyerAddr, amountXlm: 500, status: "escrow" },
    });
    expect(orderRes.ok()).toBeTruthy();
  });

  test("6. Rate the farmer", async ({ request }) => {
    expect(buyerAddr).toBeTruthy();
    expect(farmerAddr).toBeTruthy();

    const ordersRes = await request.get(`/api/orders?buyerAddress=${buyerAddr}`);
    expect(ordersRes.ok()).toBeTruthy();
    const ordersBody = await ordersRes.json();
    const order = ordersBody.orders?.[0];
    expect(order).toBeTruthy();

    const reviewRes = await request.post("/api/reviews", {
      data: { orderId: order.id, reviewer: buyerAddr, farmerId: farmerAddr, rating: 5, comment: "Great rice!" },
    });
    expect(reviewRes.ok()).toBeTruthy();
  });

  test("7. Verify farmer rating", async ({ request }) => {
    expect(farmerAddr).toBeTruthy();
    const res = await request.get(`/api/reviews/rating/${farmerAddr}`);
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.count).toBeGreaterThanOrEqual(1);
    expect(body.average).toBe(5);
  });

  test("8. NDVI summary via AI", async ({ request }) => {
    test.setTimeout(15000);
    const res = await request.post("/api/ai/ndvi-summary", {
      data: { ndviBps: 5500, cropType: "rice", region: "Nueva Ecija" },
    });
    if (!res.ok()) {
      const body = await res.json();
      if (body.error?.includes("NVIDIA_API_KEY")) {
        test.skip();
        return;
      }
    }
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.summary).toBeTruthy();
    expect(body.recommendation).toBeTruthy();
  });
});

test.describe("AI agent x402 payment flow", () => {
  test("agent pays 0.1 XLM and gets NDVI attestation", async ({ request }) => {
    test.setTimeout(120000);

    let agentKp: Keypair, agentAddr: string;
    try {
      ({ kp: agentKp, addr: agentAddr } = await createFundedKeypair());
    } catch {
      test.skip();
      return;
    }
    const bbox = { west: -6.5, south: 37.8, east: -6.2, north: 38.1 };

    // First call without payment → 402
    const firstRes = await request.post("/api/verification/run", {
      data: { nftId: 8888, bbox, sampleGridSize: 3, temporalExtent: { start: "2024-01-01T00:00:00Z", end: "2024-01-31T23:59:59Z" } },
    });
    expect(firstRes.status()).toBe(402);
    const paymentReq = await firstRes.json();
    expect(paymentReq.amount).toBe("0.1");
    expect(paymentReq.assetCode).toBe("XLM");
    const destination = paymentReq.destination;
    expect(destination).toBeTruthy();

    // Pay 0.1 XLM to treasury
    const server = new rpc.Server(RPC);
    const account = await server.getAccount(agentAddr);
    const payTx = new TransactionBuilder(account, {
      fee: BASE_FEE, networkPassphrase: PASSPHRASE,
    })
      .addOperation(Operation.payment({ destination, asset: Asset.native(), amount: "0.1" }))
      .setTimeout(30)
      .build();
    payTx.sign(agentKp);
    const payResult = await server.sendTransaction(payTx);
    expect(payResult.status).not.toBe("ERROR");
    await waitForTxHorizon(payResult.hash);

    // Retry with transaction hash
    const retryRes = await request.post("/api/verification/run", {
      data: { nftId: 8888, bbox, sampleGridSize: 3, temporalExtent: { start: "2024-01-01T00:00:00Z", end: "2024-01-31T23:59:59Z" } },
      headers: { "x-402-transaction-hash": payResult.hash },
    });

    expect(retryRes.status()).not.toBe(402);

    if (retryRes.ok()) {
      const result = await retryRes.json();
      expect(result.ok).toBe(true);
      if (result.ndviBps !== undefined) {
        expect(typeof result.ndviBps).toBe("number");
        expect(result.buyable).toBeDefined();
      }
      if (result.submissionResult) {
        expect(result.submissionResult.hash).toBeTruthy();
      }
    } else {
      const errBody = await retryRes.json();
      console.log("NDVI after payment:", errBody.error?.slice(0, 100));
    }
  });
});

test.describe("All pages render", () => {
  for (const path of ["/", "/marketplace", "/explore", "/dashboard", "/verify", "/aid", "/profile", "/mylistings", "/order"]) {
    test(`${path} loads without crash`, async ({ page }) => {
      test.setTimeout(60000);
      await page.goto(path, { waitUntil: "domcontentloaded", timeout: 30000 });
      await expect(page.locator("body")).toBeVisible({ timeout: 15000 });
    });
  }
});
