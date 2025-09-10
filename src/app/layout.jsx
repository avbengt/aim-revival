import "xp.css/dist/XP.css";
import "./globals.css";
import { WindowManagerProvider } from "@/context/WindowManagerContext";
import LoginWindow from "@/components/LoginWindow";
import BuddyListWindow from "@/components/BuddyListWindow";
import ChatWindows from "@/components/ChatWindows";
import Taskbar from "@/components/Taskbar";
import OfflineHandler from "@/components/OfflineHandler";

export const metadata = {
  title: "AOL Instant Messenger Revival | Alissa Bengtson",
  description: "Welcome back to 2001!",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="font-sans antialiased">
        <div className="fixed inset-0 z-0 bg-[url('/login/bliss-bg.jpg')] bg-cover bg-center bg-no-repeat">
          <WindowManagerProvider>
            {children}
            <LoginWindow />
            <BuddyListWindow />
            <ChatWindows />
            <Taskbar />
            <OfflineHandler />
          </WindowManagerProvider>
        </div>
      </body>
    </html>
  );
}

