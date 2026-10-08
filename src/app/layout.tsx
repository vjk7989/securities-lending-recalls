import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Securities Lending Recalls | Buckleson Demo",
  description: "A fictional multi-party demonstration of the securities lending recall workflow.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
