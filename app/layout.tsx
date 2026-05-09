import type { Metadata } from "next";
import "../src/styles/index.css";

export const metadata: Metadata = {
  title: "BUILD ARENA",
  description: "BUILD ARENA — AI-assisted interior design workspace.",
  icons: {
    icon: "/inter-logo.png",
    apple: "/inter-logo.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
