"use client";

import { createContext, useContext, useState } from "react";

const WindowManagerContext = createContext(undefined);

export function WindowManagerProvider({ children }) {
    const [loginWindowVisible, setLoginWindowVisible] = useState(true);
    const [buddyListVisible, setBuddyListVisible] = useState(false);

    return (
        <WindowManagerContext.Provider
            value={{
                loginWindowVisible,
                setLoginWindowVisible,
                buddyListVisible,
                setBuddyListVisible,
            }}
        >
            {children}
        </WindowManagerContext.Provider>
    );
}

export function useWindowManager() {
    const ctx = useContext(WindowManagerContext);
    if (!ctx) throw new Error("useWindowManager must be used within WindowManagerProvider");
    return ctx;
}