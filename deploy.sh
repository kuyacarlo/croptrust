#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

# ── Config ──────────────────────────────────────
NETWORK="${NETWORK:-testnet}"
IDENTITY="${IDENTITY:-richie}"       # stellar keys identity with admin secret
WASM_DIR="$SCRIPT_DIR/contracts/target/wasm32v1-none/release"
WASM="$WASM_DIR/agri_con.wasm"
BUILD_TARGET="wasm32v1-none"

# Wrapped XLM on Stellar Testnet (from stellar-agent-kit)
TOKEN="CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC"

# Ensure identity exists
if ! stellar keys address "$IDENTITY" &>/dev/null; then
  echo "❌ Identity '$IDENTITY' not found."
  echo "   Create it:  stellar keys generate $IDENTITY"
  echo "   Or set:     IDENTITY=your-key-name $0"
  echo "   Fund it at: https://lab.stellar.org/account/friendbot"
  exit 1
fi
ADMIN_ADDR=$(stellar keys address "$IDENTITY")

echo "═══════════════════════════════════════════"
echo "  agri_con CONTRACT — $NETWORK"
echo "  Identity:  $IDENTITY ($ADMIN_ADDR)"
echo "  Token:     Wrapped XLM"
echo "═══════════════════════════════════════════"
echo ""

# ── STEP 0: Build WASM ──
echo ">>> [0/5] Building contract WASM..."
cd "$SCRIPT_DIR/contracts"
cargo build --target "$BUILD_TARGET" --release 2>&1
cd "$SCRIPT_DIR"
echo "  WASM: $(wc -c < "$WASM") bytes"
echo ""

# ── STEP 1: Upload WASM + estimate ──
echo ">>> [1/5] Upload WASM & estimate cost..."
UPLOAD_XDR=$(stellar contract upload --wasm "$WASM" --source-account "$IDENTITY" --network "$NETWORK" --build-only 2>/dev/null | grep -oP '^[A-Za-z0-9+/=]+$' | head -1)
UPLOAD_RESULT=$(curl -s "https://soroban-${NETWORK}.stellar.org" \
  -X POST -H 'Content-Type: application/json' \
  -d "{\"jsonrpc\":\"2.0\",\"id\":1,\"method\":\"simulateTransaction\",\"params\":{\"transaction\":\"$UPLOAD_XDR\"}}")
UPLOAD_FEE=$(echo "$UPLOAD_RESULT" | jq -r '.result.minResourceFee // "N/A"')
UPLOAD_XLM=$(echo "scale=6; $UPLOAD_FEE / 10000000" | bc 2>/dev/null || echo "N/A")
echo "  Upload WASM: ${UPLOAD_FEE} stroops = ${UPLOAD_XLM} XLM"

# ── STEP 2: Upload WASM (for real) ──
echo ""
echo ">>> [2/5] Uploading WASM to $NETWORK..."
UPLOAD_OUTPUT=$(stellar contract upload --wasm "$WASM" --source-account "$IDENTITY" --network "$NETWORK" 2>&1)
echo "$UPLOAD_OUTPUT"
WASM_HASH=$(echo "$UPLOAD_OUTPUT" | grep -oP 'wasm hash \K[a-f0-9]{64}' | tail -1 || echo "already-installed")
echo "  Wasm hash: $WASM_HASH"

# ── STEP 3: Deploy + constructor estimate ──
echo ""
echo ">>> [3/5] Simulating deploy+constructor cost..."
DEPLOY_XDR=$(stellar contract deploy \
  --wasm "$WASM" \
  --source-account "$IDENTITY" \
  --network "$NETWORK" \
  --build-only \
  -- \
  --admin "$ADMIN_ADDR" \
  --usdc_token "$TOKEN" \
  --treasury "$ADMIN_ADDR" 2>/dev/null | grep -oP '^[A-Za-z0-9+/=]+$' | head -1)

if [ -n "$DEPLOY_XDR" ]; then
  DEPLOY_RESULT=$(curl -s "https://soroban-${NETWORK}.stellar.org" \
    -X POST -H 'Content-Type: application/json' \
    -d "{\"jsonrpc\":\"2.0\",\"id\":1,\"method\":\"simulateTransaction\",\"params\":{\"transaction\":\"$DEPLOY_XDR\"}}")
  DEPLOY_FEE=$(echo "$DEPLOY_RESULT" | jq -r '.result.minResourceFee // (.result.cost | "cpu:\(.cpuInsns) mem:\(.memBytes)")')
  DEPLOY_XLM=$(echo "scale=6; $DEPLOY_FEE / 10000000" | bc 2>/dev/null || echo "N/A")
  echo "  Deploy+constructor: ${DEPLOY_FEE} stroops = ${DEPLOY_XLM} XLM"
else
  echo "  Skipped (could not extract XDR)"
fi

# ── STEP 4: Actually deploy ──
echo ""
echo ">>> [4/5] Deploying contract with constructor..."
DEPLOY_OUTPUT=$(stellar contract deploy \
  --wasm "$WASM" \
  --source-account "$IDENTITY" \
  --network "$NETWORK" \
  -- \
  --admin "$ADMIN_ADDR" \
  --usdc_token "$TOKEN" \
  --treasury "$ADMIN_ADDR" 2>&1)
echo "$DEPLOY_OUTPUT"

CONTRACT_ID=$(echo "$DEPLOY_OUTPUT" | grep -oP 'C[A-Z0-9]{55}' | tail -1)
echo ""
echo "  ✓ CONTRACT ID: $CONTRACT_ID"

# ── STEP 5: Verify + mint test NFT ──
echo ""
echo ">>> [5/5] Verifying: get_admin, get_usdc_token..."
echo -n "  Admin: "
stellar contract invoke --id "$CONTRACT_ID" --source-account "$IDENTITY" --network "$NETWORK" -- get_admin 2>/dev/null | tail -1
echo -n "  Token: "
stellar contract invoke --id "$CONTRACT_ID" --source-account "$IDENTITY" --network "$NETWORK" -- get_usdc_token 2>/dev/null | tail -1

echo ""
echo ">>> Minting test NFT..."
FARMER_ADDR=$(stellar keys address "$IDENTITY")
MINT_OUTPUT=$(stellar contract invoke \
  --id "$CONTRACT_ID" \
  --source-account "$IDENTITY" \
  --network "$NETWORK" \
  -- \
  mint_crop_nft_with_listing \
  --farmer "$FARMER_ADDR" \
  --crop_type "rice" \
  --quantity 5000 \
  --price "2500000000" \
  --harvest_date 1800000000 \
  --parcel_name "Test Farm Merged" \
  --parcel_bbox_hash "bbox-merged-001" \
  --parcel_area_hectares_bps 12500 \
  --region "Cavite" \
  --min_ndvi_bps 3500 \
  --observation_window_days 30 2>&1)
echo "$MINT_OUTPUT"
NFT_ID=$(echo "$MINT_OUTPUT" | grep -oP 'nft_id: \K[0-9]+' || echo "?")

echo ""
echo ">>> Reading back crop + listing metadata..."
echo -n "  Crop: "
stellar contract invoke --id "$CONTRACT_ID" --source-account "$IDENTITY" --network "$NETWORK" -- get_crop --nft_id "$NFT_ID" 2>/dev/null | tail -1
echo -n "  Listing: "
stellar contract invoke --id "$CONTRACT_ID" --source-account "$IDENTITY" --network "$NETWORK" -- get_listing_metadata --nft_id "$NFT_ID" 2>/dev/null | tail -1

# ── COST SUMMARY ──
echo ""
echo "════════════════════════════════════════════"
echo "  DEPLOYMENT COMPLETE"
echo "════════════════════════════════════════════"
echo "  Network:    $NETWORK"
echo "  Admin:      $ADMIN_ADDR"
echo "  Token:      Wrapped XLM"
echo "  Contract:   $CONTRACT_ID"
echo ""
echo "  WASM upload cost:   ${UPLOAD_XLM} XLM"
echo "  Deploy cost:        ${DEPLOY_XLM} XLM"
echo ""
echo ""
echo "  Auto-updating .env.example and .env.local..."

for f in "$SCRIPT_DIR/.env.example" "$SCRIPT_DIR/.env.local" "$SCRIPT_DIR/.env.production" "$SCRIPT_DIR/.env.preview"; do
  if [ -f "$f" ]; then
    sed -i "s|NEXT_PUBLIC_AGRI_CON_CONTRACT_ID=.*|NEXT_PUBLIC_AGRI_CON_CONTRACT_ID=\"$CONTRACT_ID\"|" "$f"
    sed -i "s|NEXT_PUBLIC_CROP_NFT_CONTRACT_ID=.*|NEXT_PUBLIC_CROP_NFT_CONTRACT_ID=\"$CONTRACT_ID\"|" "$f"
    sed -i "s|NEXT_PUBLIC_ESCROW_CONTRACT_ID=.*|NEXT_PUBLIC_ESCROW_CONTRACT_ID=\"$CONTRACT_ID\"|" "$f"
    sed -i "s|NEXT_PUBLIC_VERIFICATION_CONTRACT_ID=.*|NEXT_PUBLIC_VERIFICATION_CONTRACT_ID=\"$CONTRACT_ID\"|" "$f"
    echo "  Updated $(basename "$f")"
  fi
done

echo ""
echo "  To deploy to Vercel:  vercel env add NEXT_PUBLIC_AGRI_CON_CONTRACT_ID production"
echo "  (paste $CONTRACT_ID)"
echo ""
echo "════════════════════════════════════════════"