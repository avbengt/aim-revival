import LoginWindow from "@/components/LoginWindow";
import BuddyListWindow from "@/components/BuddyListWindow";
import Taskbar from "@/components/Taskbar";

export default function ClientLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <LoginWindow />
      <Taskbar />
    </>
  );
}