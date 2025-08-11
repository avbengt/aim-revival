import "xp.css/dist/XP.css";
import "./globals.css";
import type { Metadata } from "next";
import { WindowManagerProvider } from "@context/WindowManagerContext";
import LoginWindow from "@/components/LoginWindow";
import BuddyListWindow from "@/components/BuddyListWindow";
import Taskbar from "@/components/Taskbar";

export const metadata: Metadata = {
  title: "AOL Instant Messenger Revival | Alissa Bengtson",
  description: "Welcome back to 2001!",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="font-sans antialiased">
        <div className="fixed inset-0 -z-10 bg-[url('/login/bliss-bg.jpg')] bg-cover bg-center bg-no-repeat" />
        <WindowManagerProvider>
          {children}
          <LoginWindow />
          <BuddyListWindow />
          <Taskbar />
        </WindowManagerProvider>
      </body>
    </html>
  );
}