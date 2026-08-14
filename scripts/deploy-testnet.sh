#!/usr/bin/env bash
#
# Deploy the merged `agri_con` Soroban contract to Stellar TESTNET and wire the
# resulting contract ID (and a read-probe address) into .env.local.
#
# Prerequisites:
#   - Stellar CLI:  cargo install --locked stellar-cli   (https://stellar.org/cli)
#   - A funded testnet identity:
#         stellar keys generate richie --network testnet --fund
#
# Usage:
#   ./scripts/deploy-testnet.sh [SOURCE_IDENTITY]
#   SOURCE=richie ADMIN=G... TREASURY=G... ./scripts/deploy-testnet.sh
#
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
CONTRACTS_DIR="$ROOT_DIR/contracts"
ENV_FILE="$ROOT_DIR/.env.local"

SOURCE="${1:-${SOURCE:-richie}}"
NETWORK="${NETWORK:-testnet}"
USDC="${USDC:-CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC}"
ADMIN="${ADMIN:-}"
TREASURY="${TREASURY:-}"

command -v stellar >/dev/null 2>&1 || {
  echo "ERROR: stellar CLI not found on PATH. Install it: cargo install --locked stellar-cli" >&2
  exit 1
}

# Resolve the deployer's public key (G...).
DEPLOYER="$(stellar keys address "$SOURCE" 2>/dev/null | tr -d '[:space:]')"
if ! printf '%s' "$DEPLOYER" | grep -Eq '^G[A-Z0-9]{55}$'; then
  echo "ERROR: could not resolve address for identity '$SOURCE'." >&2
  echo "       Create & fund it: stellar keys generate $SOURCE --network $NETWORK --fund" >&2
  exit 1
fi
[ -n "$ADMIN" ] || ADMIN="$DEPLOYER"
[ -n "$TREASURY" ] || TREASURY="$DEPLOYER"

echo "Deployer : $DEPLOYER"
echo "Admin    : $ADMIN"
echo "Treasury : $TREASURY"
echo "USDC     : $USDC"
echo "Network  : $NETWORK"
echo ""

echo ">>> Building contract (stellar contract build)..."
( cd "$CONTRACTS_DIR" && stellar contract build )

WASM="$CONTRACTS_DIR/target/wasm32v1-none/release/agri_con.wasm"
if [ ! -f "$WASM" ]; then
  WASM="$CONTRACTS_DIR/target/wasm32-unknown-unknown/release/agri_con.wasm"
fi
[ -f "$WASM" ] || { echo "ERROR: built wasm not found under contracts/target." >&2; exit 1; }
echo "WASM     : $WASM"

echo ">>> Deploying to $NETWORK..."
DEPLOY_OUT="$(stellar contract deploy \
  --wasm "$WASM" \
  --source "$SOURCE" \
  --network "$NETWORK" \
  -- \
  --admin "$ADMIN" \
  --usdc_token "$USDC" \
  --treasury "$TREASURY" 2>&1)"
echo "$DEPLOY_OUT"

CONTRACT_ID="$(printf '%s' "$DEPLOY_OUT" | grep -oE 'C[A-Z0-9]{55}' | tail -1)"
[ -n "$CONTRACT_ID" ] || { echo "ERROR: could not parse a contract ID from deploy output." >&2; exit 1; }

echo ""
echo "Deployed contract: $CONTRACT_ID"

# ── Update .env.local ───────────────────────────────────────────────
set_env_var() {
  # set_env_var KEY VALUE
  local key="$1" value="$2"
  touch "$ENV_FILE"
  if grep -Eq "^[[:space:]]*${key}=" "$ENV_FILE"; then
    # Replace existing line (use | as sed delimiter; values are G.../C... safe).
    sed -i.bak -E "s|^[[:space:]]*${key}=.*|${key}=${value}|" "$ENV_FILE" && rm -f "$ENV_FILE.bak"
  else
    printf '%s=%s\n' "$key" "$value" >> "$ENV_FILE"
  fi
}

set_env_var "NEXT_PUBLIC_AGRI_CON_CONTRACT_ID" "$CONTRACT_ID"
set_env_var "ORACLE_ADDRESS"                   "$DEPLOYER"
set_env_var "NEXT_PUBLIC_ORACLE_ADDRESS"       "$DEPLOYER"
set_env_var "TREASURY_ADDRESS"                 "$TREASURY"
set_env_var "NEXT_PUBLIC_TREASURY_ADDRESS"     "$TREASURY"

echo ""
echo "Updated .env.local:"
echo "  NEXT_PUBLIC_AGRI_CON_CONTRACT_ID=$CONTRACT_ID"
echo "  ORACLE_ADDRESS / NEXT_PUBLIC_ORACLE_ADDRESS=$DEPLOYER"
echo "  TREASURY_ADDRESS / NEXT_PUBLIC_TREASURY_ADDRESS=$TREASURY"
echo ""
echo "Restart 'npm run dev' to pick up the new environment."
