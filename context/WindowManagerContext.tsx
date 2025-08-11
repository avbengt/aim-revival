"use client";

import { createContext, useContext, useState, ReactNode } from "react";

type WindowManagerContextType = {
    loginWindowVisible: boolean;
    setLoginWindowVisible: (value: boolean) => void;
    buddyListVisible: boolean;
    setBuddyListVisible: (value: boolean) => void;
    isLoggedIn: boolean;
    setIsLoggedIn: (value: boolean) => void;
};


const WindowManagerContext = createContext<WindowManagerContextType | undefined>(undefined);

export function WindowManagerProvider({ children }: { children: ReactNode }) {
    const [loginWindowVisible, setLoginWindowVisible] = useState(true);
    const [buddyListVisible, setBuddyListVisible] = useState(false);
    const [isLoggedIn, setIsLoggedIn] = useState(false);

    return (
        <WindowManagerContext.Provider
            value={{
                loginWindowVisible,
                setLoginWindowVisible,
                buddyListVisible,
                setBuddyListVisible,
                isLoggedIn,
                setIsLoggedIn,
            }}
        >
            {children}
        </WindowManagerContext.Provider>
    );
}

export const useWindowManager = () => {
    const context = useContext(WindowManagerContext);
    if (!context) {
        throw new Error("useWindowManager must be used within a WindowManagerProvider");
    }
    return context;
};