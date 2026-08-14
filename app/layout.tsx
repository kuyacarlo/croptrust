import type { Metadata } from "next";
import "./globals.css";
import Providers from "./providers";
import FloatingAIButton from "@/components/FloatingAIButton";
import Walkthrough from "@/components/Walkthrough";
import PageTransition from "@/components/PageTransition";

export const metadata: Metadata = {
  title: "CropTrust | HarvestLock",
  description:
    "Agricultural forward contracts on Stellar with crop NFTs, escrow settlement, parcel intelligence, and satellite-gated buyability.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased" data-scroll-behavior="smooth">
      <body className="min-h-full flex flex-col">
        <Providers>
          <PageTransition>{children}</PageTransition>
          <FloatingAIButton />
          <Walkthrough />
        </Providers>
      </body>
    </html>
  );
}