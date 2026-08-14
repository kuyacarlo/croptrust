import NavigationBar from "@/components/NavigationBar";
import MarketplaceClient from "./MarketplaceClient";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default function MarketplacePage() {
  return (
    <div className="flex min-h-screen flex-col bg-stone-50">
      <NavigationBar />
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6 lg:px-8">
        <MarketplaceClient />
      </main>
    </div>
  );
}