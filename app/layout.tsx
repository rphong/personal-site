import type { Metadata } from "next";
import { SiteShell } from "../components/site-shell";
import { createPageMetadata } from "../lib/site-metadata";
import "./globals.css";
import { InitialDocumentLoadingScreen } from "./three/initial-document-loading-screen";
import { SceneProvider } from "./three/scene-provider";
import "./three/scene-runtime.css";

export function generateMetadata(): Metadata {
  return createPageMetadata("home");
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <SceneProvider>
          <InitialDocumentLoadingScreen />
          <SiteShell>{children}</SiteShell>
        </SceneProvider>
      </body>
    </html>
  );
}
