import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "PUFT",
  description: "Personal Ultimate Finance Tracker",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}
