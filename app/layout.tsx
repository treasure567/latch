import type { Metadata } from "next";
import { DM_Sans, Inter, JetBrains_Mono } from "next/font/google";
import { ScrollPolish } from "@/components/scroll-polish";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-sans",
  weight: ["200", "300", "400", "500"],
});

const dmSans = DM_Sans({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-display",
  weight: ["200", "300", "400"],
});

const jetbrains = JetBrains_Mono({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-mono",
  weight: ["400", "500"],
});

export const metadata: Metadata = {
  title: "Latch — The pool you can't rug",
  description:
    "A Uniswap v4 hook that locks launch liquidity onchain so the creator physically cannot pull it. A rug attempt reverts. Built on X Layer with a public registry of pools proven safe to buy.",
  metadataBase: new URL("https://latch.build"),
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${dmSans.variable} ${jetbrains.variable} h-full antialiased`}
    >
      <body className="min-h-full bg-[#030303] text-white font-sans font-extralight selection:bg-white/20 selection:text-white overflow-x-hidden">
        <ScrollPolish />
        {children}
      </body>
    </html>
  );
}
