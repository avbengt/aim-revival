import "./globals.css";
import "xp.css/dist/XP.css";
import { WindowManagerProvider } from "@/context/WindowManagerContext";
import LoginWindow from "@/components/LoginWindow";
import BuddyListWindow from "@/components/BuddyListWindow";
import Taskbar from "@/components/Taskbar";

export const metadata = {
  title: "AOL Instant Messenger Revival | Alissa Bengtson",
  description: "Welcome back to 2001!",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="font-sans antialiased">
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