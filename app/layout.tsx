import { Fraunces, Nunito_Sans } from "next/font/google";
import { SiteShell } from "../components/site-shell";
import "./globals.css";

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
        <SiteShell>{children}</SiteShell>
      </body>
    </html>
  );
}
