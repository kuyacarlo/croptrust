# 🚀 Redeployment Checklist (Testnet)

## Prerequisites

```bash
# 1. Install Stellar CLI
cargo install stellar-cli --version 27.0.0

# 2. Create admin identity (save the secret key!)
stellar keys generate richie

# 3. Fund it
curl "https://friendbot.stellar.org?addr=$(stellar keys address richie)"

# 4. Install Rust WASM target
rustup target add wasm32-unknown-unknown
```

## Deploy

```bash
# Build + deploy + register oracle
./deploy.sh
```

The script now:
1. Builds WASM
2. Uploads to testnet
3. Deploys contract (constructor sets admin + usdc + treasury)
4. ✅ **Registers oracle** via `add_oracle` (NEW)
5. Mints test NFT
6. Outputs contract ID + env vars

## Update Vercel

After deploy, copy the new contract ID:

```bash
vercel env add NEXT_PUBLIC_AGRI_CON_CONTRACT_ID production
# paste the contract ID from deploy output
vercel deploy --prod --yes
```

## Verify Attestation

Once deployed, test the attestation flow:

```bash
curl -X POST https://agri-con-one.vercel.app/api/verification/run \
  -H 'content-type: application/json' \
  -d '{"nftId":1,"bbox":{"west":121.0,"south":15.0,"east":121.1,"north":15.1}}'
```

Expected: `submissionResult.txHash` present (not null), no "bad union" error.

## If Attestation Still Fails

Check these in order:

| Error | Cause | Fix |
|---|---|---|
| `Error(Contract, #1)` | Oracle not registered | Re-run `add_oracle` |
| `Error(Contract, #2)` | Contract version mismatch | Rebuild + redeploy from current source |
| `"bad union"` | Wallet signature mismatch | Ensure `ORACLE_SECRET_KEY` is set in Vercel |
| Timeout | Vercel function too slow | Check `maxDuration` in `vercel.json` (should be 30) |
