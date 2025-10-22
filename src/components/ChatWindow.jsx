"use client";
import { useState, useEffect, useRef } from "react";
import { ref, push, onValue, off } from "firebase/database";
import { database, auth } from "@/lib/firebase";
import { useWindowManager } from "@/context/WindowManagerContext";

export default function ChatWindow({ recipientScreenname, recipientUid, chatId }) {
    const { closeChatWindow, focusWindow, isWindowActive, chatWindows, bringToFront, restorePreviousFocus, getWindowZIndex } = useWindowManager();
    const winRef = useRef(null);
    const [messages, setMessages] = useState([]);
    const [newMessage, setNewMessage] = useState("");
    const [currentUser, setCurrentUser] = useState(null);
    const [chatOpenedAt] = useState(() => Date.now()); // Track when this chat window was opened

    // Get the current chat window data
    const currentChat = chatWindows.find(chat => chat.id === chatId);
    const isVisible = currentChat?.visible ?? false;

    // Get current user info
    useEffect(() => {
        const unsubscribe = auth.onAuthStateChanged((user) => {
            setCurrentUser(user);
        });
        return () => unsubscribe();
    }, []);

    // Simple drag handler
    const handleMouseDown = (e) => {
        if (e.target.closest('.title-bar-controls')) return;

        const startX = e.clientX;
        const startY = e.clientY;
        const startLeft = parseInt(winRef.current.style.left || "0", 10);
        const startTop = parseInt(winRef.current.style.top || "0", 10);

        const handleMouseMove = (e) => {
            const dx = e.clientX - startX;
            const dy = e.clientY - startY;

            // Calculate new position
            let newLeft = startLeft + dx;
            let newTop = startTop + dy;

            // Get window dimensions
            const rect = winRef.current.getBoundingClientRect();
            const windowWidth = rect.width;
            const windowHeight = rect.height;

            // Clamp to viewport bounds
            newLeft = Math.max(0, Math.min(newLeft, window.innerWidth - windowWidth));
            newTop = Math.max(0, Math.min(newTop, window.innerHeight - windowHeight));

            winRef.current.style.left = `${newLeft}px`;
            winRef.current.style.top = `${newTop}px`;
        };

        const handleMouseUp = () => {
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
        };

        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);
    };

    // Handle visibility and positioning
    useEffect(() => {
        if (winRef.current) {
            // Center the window when it becomes visible
            const rect = winRef.current.getBoundingClientRect();
            const vw = window.innerWidth;
            const vh = window.innerHeight;
            const left = Math.max(0, Math.floor((vw - rect.width) / 2));
            const top = Math.max(0, Math.floor((vh - rect.height) / 2));
            winRef.current.style.left = `${left}px`;
            winRef.current.style.top = `${top}px`;
            winRef.current.style.visibility = "visible";
        }
    }, []);

    // Listen for real-time messages (only new ones after chat window opened)
    useEffect(() => {
        if (!currentUser || !recipientUid) return;

        // Create a unique chat room ID (sorted to ensure consistency)
        const chatRoomId = [currentUser.uid, recipientUid].sort().join('-');
        const messagesRef = ref(database, `chats/${chatRoomId}/messages`);

        const unsubscribe = onValue(messagesRef, (snapshot) => {
            if (!snapshot.exists()) {
                setMessages([]);
                return;
            }

            const messagesList = [];
            const seenIds = new Set();

            snapshot.forEach((childSnapshot) => {
                const messageData = childSnapshot.val();
                const messageId = childSnapshot.key;

                // Skip if we've already seen this message ID
                if (seenIds.has(messageId)) return;

                // Include messages that were sent AFTER this chat window was opened
                // OR include the most recent message if it's for the current user (the one that triggered the window)
                const isAfterWindowOpened = messageData.timestamp > chatOpenedAt;
                const isRecentMessageForMe = messageData.recipientId === currentUser.uid &&
                    messageData.timestamp >= chatOpenedAt - 10000; // 10 second buffer

                if (isAfterWindowOpened || isRecentMessageForMe) {
                    seenIds.add(messageId);
                    messagesList.push({
                        id: messageId,
                        ...messageData
                    });
                }
            });

            // Sort by timestamp
            messagesList.sort((a, b) => a.timestamp - b.timestamp);
            setMessages(messagesList);
        });

        return () => {
            off(messagesRef, 'value', unsubscribe);
        };
    }, [currentUser, recipientUid, chatOpenedAt]);

    // Auto-scroll to bottom when new messages arrive
    useEffect(() => {
        if (messages.length > 0) {
            const messageArea = document.querySelector('.message-area');
            if (messageArea) {
                messageArea.scrollTop = messageArea.scrollHeight;
            }
        }
    }, [messages]);

    // Auto-focus chat window when it becomes visible
    useEffect(() => {
        if (isVisible) {
            bringToFront(chatId);
        }
    }, [isVisible, chatId]); // Only depend on isVisible and chatId, not bringToFront

    const handleSendMessage = async (e) => {
        e.preventDefault();
        if (!newMessage.trim() || !currentUser || !recipientUid) return;

        console.log('Sending message from:', currentUser.uid, 'to:', recipientUid);

        // Create a unique chat room ID (sorted to ensure consistency)
        const chatRoomId = [currentUser.uid, recipientUid].sort().join('-');
        const messagesRef = ref(database, `chats/${chatRoomId}/messages`);

        console.log('Chat room ID:', chatRoomId);
        console.log('Messages path:', `chats/${chatRoomId}/messages`);

        const messageData = {
            text: newMessage.trim(),
            senderId: currentUser.uid,
            senderScreenname: currentUser.email.split('@')[0], // Extract screenname from email
            recipientId: recipientUid,
            recipientScreenname: recipientScreenname,
            timestamp: Date.now(),
            messageId: `${currentUser.uid}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}` // Add unique message ID
        };

        console.log('Message data being sent:', messageData);

        try {
            await push(messagesRef, messageData);
            console.log('Message sent successfully');
            setNewMessage("");
        } catch (error) {
            console.error('Error sending message:', error);
        }
    };

    return (
        <div
            ref={winRef}
            id="chat-window"
            className={`window w-[350px] h-[300px] absolute ${!isWindowActive(chatId) ? 'window-inactive' : ''}`}
            style={{
                visibility: isVisible ? "visible" : "hidden",
                zIndex: getWindowZIndex(chatId)
            }}
            onMouseDown={() => bringToFront(chatId)}
        >
            <div className="title-bar chat-header" onMouseDown={handleMouseDown}>
                <div className="title-bar-text">
                    <img src="/ui/ico-chat.png" alt="" className="h-[16px] inline-block mb-[2px]" /> {recipientScreenname} - Instant Message
                </div>
                <div className="title-bar-controls">
                    <button aria-label="Minimize" />
                    <button aria-label="Maximize" />
                    <button
                        aria-label="Close"
                        onClick={() => {
                            closeChatWindow(chatId);
                            restorePreviousFocus();
                        }}
                    />
                </div>
            </div>

            <div className="window-body flex flex-col h-full relative" style={{ height: 'calc(100% - 30px)' }}>
                {/* Menu Toolbar */}
                <div className="px-2 py-0.5 flex items-center gap-2 menu-toolbar">
                    <span className="pixelated-font">File</span>
                    <span className="pixelated-font">Edit</span>
                    <span className="pixelated-font">Insert</span>
                    <span className="pixelated-font">People</span>
                </div>
                {/* Messages Area */}
                <div className="message-area h-[95px] bg-white border border-gray-300 p-2 overflow-y-auto mb-0">
                    {messages.length > 0 && (
                        <div className="space-y-1">
                            {messages.map((message, index) => {
                                const isMyMessage = message.senderId === currentUser?.uid;
                                const senderScreenname = message.senderScreenname || 'Unknown';
                                return (
                                    <div
                                        key={`${message.id}-${message.timestamp}-${index}`}
                                        className="text-sm mb-0"
                                    >
                                        <span
                                            className={`font-bold ${isMyMessage ? 'text-red-600' : 'text-blue-600'
                                                }`}
                                            style={{ fontFamily: 'Times New Roman, serif' }}
                                        >
                                            {senderScreenname}:
                                        </span>
                                        <span className="ml-1 text-black break-words whitespace-pre-wrap" style={{ fontFamily: 'Times New Roman, serif' }}>
                                            {message.text}
                                        </span>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* Toolbar */}
                <div className="my-1 px-2 py-1 flex items-center justify-center border border-[#a7a3a0]">
                    <img src="/ui/text-bar.png" alt="" className="h-[13px]" />
                </div>

                {/* Message Input */}
                <form onSubmit={handleSendMessage} className="flex flex-col mt-0">
                    <input
                        type="text"
                        value={newMessage}
                        onChange={(e) => setNewMessage(e.target.value)}
                        className="w-full px-3 border border-gray-300 text-sm focus:outline-none"
                        style={{ height: '36px' }}
                    />
                </form>

                {/* Send Button - positioned at bottom right of window-body */}
                <img
                    src="/ui/send1.png"
                    alt="Send"
                    className="absolute bottom-2 right-2 cursor-pointer"
                    onClick={() => document.querySelector('form').requestSubmit()}
                    onMouseEnter={(e) => e.target.src = "/ui/send2.png"}
                    onMouseLeave={(e) => e.target.src = "/ui/send1.png"}
                    onMouseDown={(e) => e.target.src = "/ui/send3.png"}
                    onMouseUp={(e) => e.target.src = "/ui/send2.png"}
                />
            </div>
        </div>
    );
}
