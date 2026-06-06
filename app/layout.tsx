import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ACQUA Beach | Διαχείριση Ομπρελών",
  description: "Beach umbrella management system for ACQUA Beach Bar",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="el">
      <body style={{ margin: 0, padding: 0 }}>{children}</body>
    </html>
  );
}
