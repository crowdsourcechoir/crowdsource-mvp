import type { Metadata, Viewport } from "next";
import "./globals.css";
import { siteUrl } from "@/lib/site-url";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl()),
  title: {
    default: "Crowdsource Choir",
    template: "%s · Crowdsource Choir",
  },
  description: "Crowdsource Choir — help create the song live.",
  icons: { icon: "/logo.png" },
  openGraph: {
    siteName: "Crowdsource Choir",
    type: "website",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
