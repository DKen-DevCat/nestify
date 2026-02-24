import type { Metadata } from "next";
import { Syne, Space_Mono } from "next/font/google";
import { Providers } from "./providers";
import "./globals.css";

const syne = Syne({
  variable: "--font-syne",
  subsets: ["latin"],
});

const spaceMono = Space_Mono({
  variable: "--font-space-mono",
  subsets: ["latin"],
  weight: ["400", "700"],
});

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://nestify-frontend-57y3.vercel.app";
const SITE_DESCRIPTION =
  "Spotify のプレイリストをフォルダのように無限にネストして管理。子孫プレイリストを含めたシャッフル再生にも対応。";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Nestify",
    template: "%s | Nestify",
  },
  description: SITE_DESCRIPTION,
  keywords: ["Spotify", "プレイリスト", "ネスト", "音楽管理", "Nestify"],
  authors: [{ name: "Nestify" }],
  openGraph: {
    title: "Nestify — ネスト型プレイリスト管理",
    description: SITE_DESCRIPTION,
    url: SITE_URL,
    siteName: "Nestify",
    locale: "ja_JP",
    type: "website",
    images: [{ url: "/opengraph-image", width: 1200, height: 630 }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Nestify — ネスト型プレイリスト管理",
    description: SITE_DESCRIPTION,
  },
  robots: {
    index: false,
    follow: false,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja" className="dark">
      <body
        className={`${syne.variable} ${spaceMono.variable} antialiased`}
      >
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
