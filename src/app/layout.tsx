import type { Metadata, Viewport } from "next";
import { Lato } from "next/font/google";
import "./globals.css";

const lato = Lato({ subsets: ["latin"], weight: ["400", "700", "900"], variable: "--font" });

export const metadata: Metadata = {
  title: "Prime Console",
  description: "Feedback from Prime Productivity's apps",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "Prime Console", statusBarStyle: "default" },
  icons: { icon: [{ url: "/logo.svg", type: "image/svg+xml" }, { url: "/icon-192.png" }], apple: "/apple-icon.png" },
};

export const viewport: Viewport = { themeColor: "#f6f4f0", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={lato.variable}>
      <body>{children}</body>
    </html>
  );
}
