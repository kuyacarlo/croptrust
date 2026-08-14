# Soroban Contracts

This workspace splits CropTrust into the three contracts described in the
product flow:

- `crop_nft`: mints and tracks crop-backed NFT listings
- `escrow`: records USDC reservation state and payment splits
- `verification`: stores proof anchors and validator decisions

The current scaffold now includes:

- storage models are defined
- public entrypoints map to the walkthrough flow
- escrow pulls crop price and farmer data from the crop NFT contract
- USDC reservation and farmer/treasury split use `soroban_sdk::token::TokenClient`
- verification calls escrow and crop NFT contracts for success and failure settlement

Still intentionally deferred:

- treasury compensation is recorded in settlement state, but not paid out automatically yet
- no disaster NFT contract exists yet
- no unit or integration tests exist yet

Recommended next implementation order:

1. Add a treasury-controlled payout flow for disaster compensation.
2. Introduce a dedicated disaster NFT or claims contract if that asset is part of the protocol.
3. Add unit tests for split rules, authorization chains, and disaster settlement.
