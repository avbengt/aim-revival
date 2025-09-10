"use client";
import { useWindowManager } from "@/context/WindowManagerContext";
import ChatWindow from "@/components/ChatWindow";

export default function ChatWindows() {
    const { chatWindows, closeChatWindow } = useWindowManager();

    return (
        <>
            {chatWindows.map((chat) => (
                <ChatWindow
                    key={chat.id}
                    chatId={chat.id}
                    recipientScreenname={chat.recipientScreenname}
                    recipientUid={chat.recipientUid}
                />
            ))}
        </>
    );
}
