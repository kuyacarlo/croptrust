# Tasks

## High Priority
- [ ] **Verify contract on stellar.expert** — upload `Cargo.toml` + `src/lib.rs` at https://stellar.expert/explorer/testnet/contract/CAUSYMAROJZIFUWFLWDHSYJYHMHXPNVC2Z72AM6R3MGVEEH6HT7YRCHR
- [ ] **Mint remaining 3 NFTs** — Navarro Rice & Grain (#5), Garcia Sustainable Crops (#6), Villanueva Rice Terraces (#3) on the new contract
- [ ] **Align DB and chain data** — re-seed Supabase `listings` and `profiles` tables with new contract NFT IDs

## Medium Priority
- [ ] **Fix RPC reliability** — add retry/backoff to `getLiveListings()` calls in `lib/stellar/live-data.ts`
- [ ] **Update seed script** (`e2e/seed-real.mjs`) — mint on-chain NFTs + write to Supabase DB in one pass
