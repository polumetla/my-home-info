import type { Metadata, Viewport } from "next";
import { Source_Sans_3 } from "next/font/google";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { SearchOverlay } from "@/components/search-overlay";
import { SiteSearchProvider } from "@/components/site-search-provider";
import { siteConfig } from "@/lib/site-config";
import "./globals.css";

const sans = Source_Sans_3({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: siteConfig.name,
    template: `%s · ${siteConfig.name}`,
  },
  description: siteConfig.tagline,
  manifest: "/manifest.webmanifest",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#f8fafc",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={sans.variable}>
      <body className="font-sans">
        <SiteSearchProvider>
          <SiteHeader />
          <main className="mx-auto max-w-5xl px-4 py-10">{children}</main>
          <SiteFooter />
          <SearchOverlay />
        </SiteSearchProvider>
      </body>
    </html>
  );
}
