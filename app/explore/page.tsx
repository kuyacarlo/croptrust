import NavigationBar from "@/components/NavigationBar";
import { getLiveListings } from "@/lib/stellar/live-data";
import ExploreWorkspace from "./ExploreWorkspace";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function ExplorePage() {
  let listings: Awaited<ReturnType<typeof getLiveListings>> = [];
  try {
    const all = await getLiveListings();
    listings = all.filter((l) => l.cropType !== null && l.parcelName !== null);
  } catch {}

  const parcels = listings.map((l) => ({
    id: l.nftId,
    title: l.parcelName ?? l.cropType ?? `Parcel #${l.nftId}`,
    lat: 0,
    lng: 0,
    temporalExtent: {
      start: "2026-04-19T00:00:00Z",
      end: "2026-05-19T23:59:59Z",
    },
    region: l.region,
    ndviBps: l.ndviBps,
    buyable: l.buyable,
    noCoords: true,
  }));

  return (
    <div className="flex min-h-screen flex-col bg-stone-50">
      <NavigationBar />
      <div className="mx-auto w-full max-w-7xl flex-1 px-3 py-4 sm:px-6 sm:py-6">
        <ExploreWorkspace parcels={parcels} />
      </div>
    </div>
  );
}