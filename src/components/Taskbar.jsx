"use client";
import Clock from "@/components/Clock";
import { useWindowManager } from "@/context/WindowManagerContext";

export default function Taskbar() {
    const {
        loginWindowVisible,
        setLoginWindowVisible,
        buddyListVisible,
        setBuddyListVisible,
        isLoggedIn,
        chatWindows,
        setChatWindowVisible,
        isWindowActive,
        currentUserScreenname,
    } = useWindowManager();

    return (
        <footer className="fixed bottom-0 left-0 right-0 title-bar rounded-none! z-50 flex items-center">
            <button className="start">
                <img
                    src="/layout/icons/icon-win.png"
                    className="w-[20px] h-[20px] inline-block drop-shadow-sm"
                />{" "}
                start
            </button>

            <div className="flex-1 mx-[10px] text-xs flex">
                {!isLoggedIn ? (
                    <button
                        className={`taskbar-button ${loginWindowVisible
                            ? "bg-[#d6d6d6] border-t border-l border-[#f5f5f5] border-r-2 border-b-2 border-[#808080]"
                            : ""
                            }`}
                        onClick={() => setLoginWindowVisible((prev) => !prev)}
                    >
                        <img
                            src="/login/running-man.svg"
                            className="inline-block w-4 h-4"
                        />
                        Sign On
                    </button>
                ) : (
                    <>
                        <button
                            className={`taskbar-button ${buddyListVisible
                                ? "bg-[#d6d6d6] border-t border-l border-[#f5f5f5] border-r-2 border-b-2 border-[#808080]"
                                : ""
                                }`}
                            onClick={() => setBuddyListVisible((prev) => !prev)}
                        >
                            <img
                                src="/login/running-man.svg"
                                className="inline-block w-4 h-4 mr-1"
                            />
                            {currentUserScreenname}'s Buddy List
                        </button>

                        {/* Chat Window Buttons */}
                        {chatWindows.map((chat) => (
                            <button
                                key={chat.id}
                                className={`taskbar-button ${chat.visible
                                    ? "bg-[#d6d6d6] border-t border-l border-[#f5f5f5] border-r-2 border-b-2 border-[#808080]"
                                    : ""
                                    }`}
                                onClick={() => {
                                    console.log('Toggling chat window:', chat.id, 'Current visible:', chat.visible);
                                    setChatWindowVisible(chat.id, !chat.visible);
                                }}
                            >
                                <img
                                    src="/login/running-man.svg"
                                    className="inline-block w-4 h-4 mr-1"
                                />
                                {chat.recipientScreenname}
                            </button>
                        ))}
                    </>
                )}
            </div>

            <Clock />
        </footer>
    );
}