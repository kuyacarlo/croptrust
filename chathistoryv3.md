# Chat History v3 — Latest Changes + Planning

## Session Start: Latest fixes, NVIDIA migration, polygon drawing

### Planning Stage / Todo

**Goal**: Document recent work and merge latest changes into chathistoryv3 files.

**Completed**:
- ✅ Added latest changes to `chathistoryv3.readme`
- ✅ Added latest changes to `chathistoryv3.md`
- ✅ Added planning stage / todo into `chathistoryv3.md`

**Next Steps**:
- Verify all recent commit changes are accurately recorded
- Cross-reference with any remaining uncommitted work

---

### Change 1: Switch AI from Gemini to NVIDIA API
**Commit**: `14a4a49`

- Replaced Gemini (`@google/generative-ai`) with direct NVIDIA NIM API calls
- New config-driven helper `getConfig()` reads `NVIDIA_API_KEY` and `AI_MODEL`
- Default model: `meta/llama-3.3-70b-instruct`
- System prompt updated to reference Stellar blockchain context
- NDVI summary route now enforces strict JSON-only response (no markdown fences)

**Files modified**:
- `app/api/ai/chat/route.ts` — full rewrite to NVIDIA chat completions endpoint
- `app/api/ai/ndvi-summary/route.ts` — same switch + stricter JSON parsing

### Change 2: Stellar API — missing actions + live reads
**Commit**: `c38bf97`

- Added `get_farmer_profile` — looks up profile on-chain by address
- Added `get_all_listings` — fetches all live listings from ledger data
- Removed outer `payload` wrapper from request body (actions now read top-level params)
- Simplified `RequestBody` type to `BodyParams`

**Files modified**:
- `app/api/stellar/route.ts`

### Change 3: Profile page uses backend API
**Commit**: `c38bf97`

- Fetch profile from `NEXT_PUBLIC_BACKEND_URL` first; fall back to `GET /api/stellar`
- Profile save now submits to backend POST instead of preparing a Stellar tx
- ID upload sends `x-goog-content-length-range: 0,10485760` header
- Better error handling and fallback chaining

**Files modified**:
- `app/profile/page.tsx`

### Change 4: Clamp negative NDVI
**Commit**: `14a4a49`

- NDVI values below 0 are clamped to 0 before buyability computation
- Response now includes `rawNdviBps` (unclamped) alongside `ndviBps`
- Prevents false "unhealthy" classification on water/cloud pixels

**Files modified**:
- `app/api/verification/run/route.ts`

### Change 5: Polygon drawing on map
**Commit**: `14a4a49`

- Added `libraries=drawing` to Google Maps script loader
- New `drawMode` prop: `"rect" | "polygon" | "none"`
- Added `DrawingManager` for polygon overlay creation
- Toggle button in explore workspace switches between rectangle and polygon mode
- Polygon vertices auto-compute bounding box for verification
- Drawing instruction tooltip shown during polygon mode

**Files modified**:
- `components/ParcelMap.tsx` — added drawing manager, polygon support, refactored types
- `app/explore/ExploreWorkspace.tsx` — added draw toggle, polygon state, bbox computation

### Change 6: Render deployment config
**Commits**: `5f87233`, `1750098`, `db7cfda`

- PostgreSQL database service (`agri-con-db`, free tier v16) in `render.yaml`
- Backend service:
  - Build: `npm ci && npx prisma generate && npx prisma migrate deploy`
  - Start: `node start.js`
  - Port 8080 with health check at `/health`
  - `DATABASE_URL` via `fromDatabase` reference
- Frontend removed from render.yaml (deployed separately on Vercel)
- Backend `server.js` bound to `0.0.0.0` for Render compatibility
- Added `backend/start.js` as production entry point

**Files modified**:
- `render.yaml` — complete rewrite
- `backend/server.js` — added `HOST = "0.0.0.0"` binding
- `backend/start.js` — new production entry file
- `backend/prisma/schema.prisma` — model definitions
- `backend/src/db.js` — new database client module
- `backend/Dockerfile`, `backend/package.json`

---

## Key Env Var Changes
- Removed: `GEMINI_API_KEY`
- Added: `NVIDIA_API_KEY` (required), `AI_MODEL` (optional, default `meta/llama-3.3-70b-instruct`)
- Added: `NEXT_PUBLIC_BACKEND_URL` (points to Render backend)
- Google Maps: libraries now includes `drawing` in addition to `marker`

## Current Stable Contract IDs (unchanged from v2)
- Crop NFT: `CCA2E4OOZOR2NLAL2XEWE3KDHTTPDEBWOUX3BMR5QLOITWHOKWKULULR`
- Escrow: `CDMKYC3VBHZJZMTEN6FQPFKG6LRYXIYOIP5KHEOPGSWCCYRSYXJSZFOQ`
- Verification: `CA3NIAKLHQN3SKNBUGSWLOZRWY4BNNSKWCPI2BJIHZGYZM4J3QLW4GSA`
- USDC: `CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC`
