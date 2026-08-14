# CropTrust Postman Tests

End-to-end API tests for the Next.js route handlers (`frontendUrl`) and the Express
backend (`backendUrl`).

## Files

- `agri-con.postman_collection.json` — requests + test scripts for every endpoint
- `agri-con.postman_environment.json` — `frontendUrl`, `backendUrl`, and sample addresses

## Run in the Postman app

1. Import both files.
2. Select the **CropTrust (Local)** environment.
3. Start the servers locally:
   - Frontend: `npm run dev` (port 3000)
   - Backend: `node backend/server.js` (port 8080, needs `DATABASE_URL`)
4. Run the collection (or a folder).

## Run headless with Newman

```bash
npm i -g newman
newman run postman/agri-con.postman_collection.json \
  -e postman/agri-con.postman_environment.json
```

Point at deployed environments by overriding variables:

```bash
newman run postman/agri-con.postman_collection.json \
  -e postman/agri-con.postman_environment.json \
  --env-var "frontendUrl=https://agri-con.vercel.app" \
  --env-var "backendUrl=https://agri-con-backend.onrender.com"
```

## Notes

- Endpoints that require external services degrade gracefully:
  - `/api/ai/*` returns a fallback reply when no AI key is configured.
  - `/api/openeo` and `/api/verification/run` need openEO OIDC credentials to return live data.
  - `/api/farmer-id/upload-url` returns `400` unless `GCP_FARMER_ID_BUCKET` is set.
- The backend tests assume a reachable PostgreSQL database (`DATABASE_URL`) with the Prisma
  schema applied (`npx prisma db push`).
- The `POST /api/listings` test stores the created `listingId` back into the environment so the
  `POST /api/orders` test can reference it.
