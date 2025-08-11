"use client";

import { useWindowManager } from "@context/WindowManagerContext";
import LoginWindow from "@/components/LoginWindow";
import BuddyListWindow from "@/components/BuddyListWindow";
import Taskbar from "@/components/Taskbar";

export default function ClientLayout({ children }: { children: React.ReactNode }) {
    const { buddyListVisible } = useWindowManager();

    return (
        <>
            {children}
            <LoginWindow />
            {buddyListVisible && <BuddyListWindow />}
            <Taskbar />
        </>
    );
}