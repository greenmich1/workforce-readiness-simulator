import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Enterprise Scheduler · The people",
  description: "Training schedules for a dairy manufacturer-exporter's sites and offices, optimised with Google's CP-SAT constraint solver.",
};

/**
 * The SAP & AI family (public/ops-family/FAMILY.md, 2026-10-02): Dairy Twin's fonts and tokens, and
 * the cross-app header linking Dairy Twin, Maritime OS and this scheduler.
 */
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Newsreader:opsz,wght@6..72,500;6..72,600&family=Figtree:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap" />
        <link rel="stylesheet" href="/ops-family/family.css" />
        {/* The phone version (greenwell/docs/MOBILE.md), on the scheduler only: the site picker at / already works on a
            phone and scrolls, which the family kit's sheet would stop. Set before first paint. */}
        <script dangerouslySetInnerHTML={{ __html: "if(location.pathname.indexOf('/app')===0&&matchMedia('(max-width: 759px), (pointer: coarse) and (max-height: 500px)').matches)document.documentElement.classList.add('phone')" }} />
        <link rel="stylesheet" href="/ops-family/phone.css" />
        {/* eslint-disable-next-line @next/next/no-sync-scripts */}
        <script type="module" src="/ops-family/ops-suite.js" />
      </head>
      <body className="antialiased">
        <div dangerouslySetInnerHTML={{ __html: '<ops-suite current="scheduler"></ops-suite>' }} />
        {children}
      </body>
    </html>
  );
}
