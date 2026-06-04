import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider } from "./auth-client";

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
      <body>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
