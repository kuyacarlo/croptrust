import Footer from "@/components/Footer";
import NavigationBar from "@/components/NavigationBar";
import HeroComponent from "@/components/HeroComponent";
import { HowItWorksSection, ChoosePathSection, StatsBanner } from "@/components/HomeClient";
import { getLiveListings, getLiveFarmerProfiles } from "@/lib/stellar/live-data";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function Home() {
  let listings: Awaited<ReturnType<typeof getLiveListings>> = [];
  let profiles: Awaited<ReturnType<typeof getLiveFarmerProfiles>> = [];
  try { listings = await getLiveListings(); } catch {}
  try { profiles = await getLiveFarmerProfiles(); } catch {}

  const buyableCount = listings.filter((l) => l.buyable).length;
  const totalVolume = listings
    .filter((l) => l.priceXlm !== null)
    .reduce((s, l) => s + parseFloat(l.priceXlm ?? "0"), 0);
  const verifiedCount = profiles.filter((p) => p.verified).length;

  return (
    <div className="min-h-screen bg-transparent text-stone-900">
      <NavigationBar />
      <main className="pb-12">
        <HeroComponent
          listingCount={listings.length}
          buyableCount={buyableCount}
          totalVolume={totalVolume}
          farmerCount={profiles.length}
        />

        <HowItWorksSection />
        <ChoosePathSection />
        {(listings.length > 0 || profiles.length > 0) && (
          <StatsBanner
            listingCount={listings.length}
            buyableCount={buyableCount}
            totalVolume={totalVolume}
            verifiedCount={verifiedCount}
          />
        )}
      </main>
      <Footer />
    </div>
  );
}