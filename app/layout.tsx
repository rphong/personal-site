import type { Metadata } from "next";
import { Fraunces, Nunito_Sans } from "next/font/google";
import { SiteShell } from "../components/site-shell";
import { createPageMetadata } from "../lib/site-metadata";
import "./globals.css";
import { SceneProvider } from "./three/scene-provider";
import "./three/scene-runtime.css";

export function generateMetadata(): Metadata {
  return createPageMetadata("home");
}

const nunitoSans = Nunito_Sans({
  subsets: ["latin"],
  variable: "--font-body",
  display: "swap",
});

const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
});

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${nunitoSans.variable} ${fraunces.variable}`}>
        <SceneProvider>
          <SiteShell>{children}</SiteShell>
        </SceneProvider>
      </body>
    </html>
  );
}
