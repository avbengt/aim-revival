import type { Metadata } from "next";
import { WindowManagerProvider } from "@context/WindowManagerContext";
import ClientLayout from "@/components/ClientLayout";
import "./globals.css";
import "xp.css/dist/XP.css";

export const metadata: Metadata = {
  title: "AOL Instant Messenger Revival | Alissa Bengtson",
  description: "Welcome back to 2001!",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="font-sans antialiased">
        <WindowManagerProvider>
          <ClientLayout>{children}</ClientLayout>
        </WindowManagerProvider>
      </body>
    </html>
  );
}