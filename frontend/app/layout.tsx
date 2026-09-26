import type { Metadata } from "next";
import { Inter, JetBrains_Mono, Space_Grotesk } from "next/font/google";
import "../styles/tokens.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-body"
});

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-display"
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono"
});

export const metadata: Metadata = {
  title: "Migration Rehearsal Agent",
  description: "Prove what your migration does to real data."
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={`${inter.variable} ${spaceGrotesk.variable} ${jetbrainsMono.variable}`}>
        {children}
        <script src="/interactive-bot.js" type="module" />
      </body>
    </html>
  );
}