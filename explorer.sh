#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
NETWORK="${NETWORK:-testnet}"
IDENTITY="${IDENTITY:-richie}"

if [ $# -ge 1 ]; then
  CONTRACT_ID="$1"
else
  CONTRACT_ID=$(grep -oP 'NEXT_PUBLIC_AGRI_CON_CONTRACT_ID="\K[^"]+' "$SCRIPT_DIR/.env.example" 2>/dev/null || true)
  if [ -z "$CONTRACT_ID" ] && [ -f "$SCRIPT_DIR/.env.local" ]; then
    CONTRACT_ID=$(grep -oP 'NEXT_PUBLIC_AGRI_CON_CONTRACT_ID="\K[^"]+' "$SCRIPT_DIR/.env.local" 2>/dev/null || true)
  fi
fi

if [ -z "$CONTRACT_ID" ]; then
  echo "Usage: $0 [contract-id]"
  exit 1
fi

S="--source-account $IDENTITY --network $NETWORK"

echo "════════════════════════════════════════════"
echo "  agri_con EXPLORER"
echo "  Network:   $NETWORK"
echo "  Contract:  $CONTRACT_ID"
echo "════════════════════════════════════════════"

echo ""
echo "── [1] Contract Info ──"
echo -n "  Admin:   "
stellar contract invoke --id "$CONTRACT_ID" $S -- get_admin 2>/dev/null || echo "ERR"
echo -n "  Token:   "
stellar contract invoke --id "$CONTRACT_ID" $S -- get_usdc_token 2>/dev/null || echo "ERR"
echo -n "  Treasury: "
stellar contract invoke --id "$CONTRACT_ID" $S -- get_treasury 2>/dev/null || echo "ERR"
echo -n "  Pool:    "
stellar contract invoke --id "$CONTRACT_ID" $S -- get_treasury_pool_balance 2>/dev/null || echo "ERR"

NEXT_ID=$(stellar contract invoke --id "$CONTRACT_ID" $S -- get_next_nft_id 2>/dev/null || echo "0")
NFT_COUNT=$((NEXT_ID - 1))
echo ""
echo "── [2] NFT Inventory ──"
echo "  Next NFT ID: $NEXT_ID"
echo "  Total NFTs:  $NFT_COUNT"

if [ "$NFT_COUNT" -le 0 ]; then
  echo "  No NFTs found."
  exit 0
fi

for (( i=1; i<NEXT_ID; i++ )); do
  echo ""
  echo "── [NFT #$i] ──"
  CROP=$(stellar contract invoke --id "$CONTRACT_ID" $S -- get_crop --nft_id "$i" 2>/dev/null || true)
  if [ -n "$CROP" ]; then
    echo "  Crop: $CROP"
  fi
  OWNER=$(stellar contract invoke --id "$CONTRACT_ID" $S -- get_farmer --nft_id "$i" 2>/dev/null || true)
  if [ -n "$OWNER" ]; then
    echo "  Owner: $OWNER"
  fi
  LISTING=$(stellar contract invoke --id "$CONTRACT_ID" $S -- get_listing_metadata --nft_id "$i" 2>/dev/null || true)
  if [ -n "$LISTING" ]; then
    echo "  Listing: $LISTING"
  fi
done

echo ""
echo "════════════════════════════════════════════"
echo "  Stellar Expert:"
echo "  https://stellar.expert/explorer/$NETWORK/contract/$CONTRACT_ID"
echo "════════════════════════════════════════════"
