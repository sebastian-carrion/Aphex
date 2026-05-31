import type { Metadata } from "next";
import { Young_Serif } from "next/font/google";
import localFont from "next/font/local";
import { SpeedInsights } from "@vercel/speed-insights/next";
import "./globals.css";

const sfPro = localFont({
  variable: "--font-space-grotesk",
  src: [
    { path: "../../public/fonts/SF-Pro-Text-Regular.otf",  weight: "400", style: "normal" },
    { path: "../../public/fonts/SF-Pro-Text-Medium.otf",   weight: "500", style: "normal" },
    { path: "../../public/fonts/SF-Pro-Text-Semibold.otf", weight: "600", style: "normal" },
    { path: "../../public/fonts/SF-Pro-Text-Bold.otf",     weight: "700", style: "normal" },
  ],
});

const youngSerif = Young_Serif({
  variable: "--font-young-serif",
  subsets: ["latin"],
  weight: ["400"],
});

export const metadata: Metadata = {
  title: "Aphex — Tip Tracker",
  description: "Track your barista tips and earnings.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${sfPro.variable} ${youngSerif.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {children}
        <SpeedInsights />
      </body>
    </html>
  );
}
