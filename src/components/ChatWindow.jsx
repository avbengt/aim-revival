"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import { ref, push, onValue, off, get } from "firebase/database";
import { database, auth } from "@/lib/firebase";
import { useWindowManager } from "@/context/WindowManagerContext";

export default function ChatWindow({ recipientScreenname, recipientUid, chatId }) {
    const { closeChatWindow, focusWindow, isWindowActive, chatWindows, bringToFront, restorePreviousFocus, getWindowZIndex, setChatWindowVisible, currentUserScreenname } = useWindowManager();
    const winRef = useRef(null);
    const [messages, setMessages] = useState([]);
    const [newMessage, setNewMessage] = useState("");
    const [currentUser, setCurrentUser] = useState(null);
    const [chatOpenedAt] = useState(() => Date.now()); // Track when this chat window was opened
    const [senderScreennames, setSenderScreennames] = useState({}); // Cache of screennames by UID
    const fetchingScreennamesRef = useRef(new Set()); // Track which screennames we're currently fetching
    const hasPlayedRingRef = useRef(false); // Track if we've played the ring sound for this chat window
    const previousMessagesCountRef = useRef(0); // Track previous message count to detect new messages
    const windowBecameVisibleAtRef = useRef(Date.now()); // Track when window last became visible
    const shouldResetMessageCountRef = useRef(false); // Flag to reset message count on next listener run
    const lastRingPlayTimeRef = useRef(0); // Track when we last played ring to prevent double sounds

    // Animation states
    const [isAnimating, setIsAnimating] = useState(false);
    const [storedPosition, setStoredPosition] = useState(null);
    const [hasBeenShownBefore, setHasBeenShownBefore] = useState(false);

    // Calculate a unique position for each window based on chatId
    const getWindowPosition = () => {
        // Use a simple hash of the chatId to get consistent positioning
        let hash = 0;
        for (let i = 0; i < chatId.length; i++) {
            const char = chatId.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32bit integer
        }

        // Use hash to determine position (modulo to keep within reasonable bounds)
        const left = 50 + (Math.abs(hash) % 200);
        const top = 50 + (Math.abs(hash) % 150);

        return { left: `${left}px`, top: `${top}px` };
    };

    const windowPosition = getWindowPosition();

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

    // Simple visibility management
    useEffect(() => {
        if (winRef.current && isVisible) {
            winRef.current.style.visibility = "visible";
            // Reset ring sound tracker when window becomes visible
            // This ensures the next new message will play ring.wav
            windowBecameVisibleAtRef.current = Date.now();
            hasPlayedRingRef.current = false; // Reset so ring can play again for the first message
            lastRingPlayTimeRef.current = 0; // Reset the last ring play time
            // Flag to reset message count in the next listener run
            shouldResetMessageCountRef.current = true;
        } else if (winRef.current && !isVisible) {
            winRef.current.style.visibility = "hidden";
            // Reset the ring flag when window is hidden so it can play again when window reopens
            hasPlayedRingRef.current = false;
            lastRingPlayTimeRef.current = 0;
        }
    }, [isVisible]);

    // Listen for real-time messages (only new ones after chat window opened)
    useEffect(() => {
        if (!currentUser || !recipientUid) return;

        // Create a unique chat room ID (sorted to ensure consistency)
        const chatRoomId = [currentUser.uid, recipientUid].sort().join('-');
        const messagesRef = ref(database, `chats/${chatRoomId}/messages`);

        const unsubscribe = onValue(messagesRef, (snapshot) => {
            if (!snapshot.exists()) {
                setMessages([]);
                previousMessagesCountRef.current = 0;
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

            // Filter to only received messages (not sent by current user) from the entire list
            const allReceivedMessages = messagesList.filter(message => message.senderId !== currentUser?.uid);

            // Handle window becoming visible
            if (shouldResetMessageCountRef.current) {
                // Reset the message count baseline FIRST
                previousMessagesCountRef.current = messagesList.length;
                shouldResetMessageCountRef.current = false;

                // If window just became visible and there are existing received messages, play ring for first one
                if (allReceivedMessages.length > 0 && !hasPlayedRingRef.current) {
                    hasPlayedRingRef.current = true;
                    lastRingPlayTimeRef.current = Date.now();
                    const ringAudio = new Audio('/sounds/ring.wav');
                    ringAudio.play().catch(err => console.log('Error playing ring sound:', err));

                    // Update state and return early
                    previousMessagesCountRef.current = messagesList.length;
                    setMessages(messagesList);
                    return;
                }
            }

            // Check if there are new messages (messages we haven't seen before)
            const previousCount = previousMessagesCountRef.current;
            const currentCount = messagesList.length;
            const hasNewMessages = currentCount > previousCount;

            // Play sounds for new messages (but skip ring if we just played it within the last 200ms to prevent double sounds)
            if (hasNewMessages && messagesList.length > 0) {
                // Get the new messages (ones that weren't in the previous count)
                const newMessages = messagesList.slice(previousCount);

                // Filter to only received messages (not sent by current user)
                const receivedMessages = newMessages.filter(message => message.senderId !== currentUser?.uid);

                if (receivedMessages.length > 0) {
                    // Play ring for the very first received message after window became visible
                    // After that, all subsequent messages play imrcv
                    if (!hasPlayedRingRef.current) {
                        // Check if we just played ring recently (within 200ms) - if so, skip to prevent double sound
                        const timeSinceLastRing = Date.now() - lastRingPlayTimeRef.current;
                        if (timeSinceLastRing > 200) {
                            // This is the first received message after window became visible
                            hasPlayedRingRef.current = true;
                            lastRingPlayTimeRef.current = Date.now();
                            const ringAudio = new Audio('/sounds/ring.wav');
                            ringAudio.play().catch(err => console.log('Error playing ring sound:', err));
                        } else {
                            // Ring was just played, just mark as played without playing again
                            hasPlayedRingRef.current = true;
                        }

                        // Play imrcv for the remaining messages in this batch (if any)
                        if (receivedMessages.length > 1) {
                            receivedMessages.slice(1).forEach(() => {
                                const receiveAudio = new Audio('/sounds/imrcv.wav');
                                receiveAudio.play().catch(err => console.log('Error playing imrcv sound:', err));
                            });
                        }
                    } else {
                        // Ring has already been played, so play imrcv for all new messages
                        receivedMessages.forEach(() => {
                            const receiveAudio = new Audio('/sounds/imrcv.wav');
                            receiveAudio.play().catch(err => console.log('Error playing imrcv sound:', err));
                        });
                    }
                }
            }

            previousMessagesCountRef.current = currentCount;
            setMessages(messagesList);

            // Fetch proper screennames from Firebase for all unique sender UIDs
            const uniqueSenderIds = Array.from(new Set(messagesList.map(msg => msg.senderId).filter(Boolean)));
            uniqueSenderIds.forEach(async (senderUid) => {
                // Skip if already cached or currently fetching
                if (senderScreennames[senderUid] || fetchingScreennamesRef.current.has(senderUid)) {
                    return;
                }

                // Mark as fetching
                fetchingScreennamesRef.current.add(senderUid);

                try {
                    const userStatusRef = ref(database, `status/${senderUid}`);
                    const statusSnapshot = await get(userStatusRef);
                    if (statusSnapshot.exists()) {
                        const userData = statusSnapshot.val();
                        if (userData.screenname) {
                            setSenderScreennames(prev => {
                                // Double-check we don't already have it (race condition protection)
                                if (prev[senderUid]) return prev;
                                return {
                                    ...prev,
                                    [senderUid]: userData.screenname
                                };
                            });
                        }
                    }
                } catch (error) {
                    console.error(`Error fetching screenname for ${senderUid}:`, error);
                } finally {
                    // Remove from fetching set
                    fetchingScreennamesRef.current.delete(senderUid);
                }
            });
        });

        return () => {
            off(messagesRef, 'value', unsubscribe);
        };
    }, [currentUser, recipientUid, chatOpenedAt]);

    // Auto-scroll to bottom when new messages arrive
    useEffect(() => {
        if (messages.length > 0) {
            const messageArea = winRef.current?.querySelector('.message-area');
            if (messageArea) {
                messageArea.scrollTop = messageArea.scrollHeight;
            }
        }
    }, [messages]);

    // Create a stable callback for bringing window to front
    const handleBringToFront = useCallback(() => {
        // Temporarily disabled to test - this was working
        console.log('Bring to front called for:', chatId);
    }, [chatId]);


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
            senderScreenname: currentUserScreenname || currentUser.email.split('@')[0], // Use proper cased screenname from context
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

            // Play send sound
            const sendAudio = new Audio('/sounds/imsend.wav');
            sendAudio.play().catch(err => console.log('Error playing imsend sound:', err));
        } catch (error) {
            console.error('Error sending message:', error);
        }
    };

    // Animation functions
    const animateMinimize = () => {
        console.log('animateMinimize called for chat:', chatId);
        console.log('winRef.current:', !!winRef.current);
        console.log('isAnimating:', isAnimating);

        if (!winRef.current || isAnimating) {
            console.log('Skipping animateMinimize - winRef:', !!winRef.current, 'isAnimating:', isAnimating);
            return;
        }

        console.log('Starting minimize animation for chat:', chatId);
        setIsAnimating(true);
        const window = winRef.current;

        // Store current position before minimizing
        const currentLeft = parseInt(window.style.left || "0", 10);
        const currentTop = parseInt(window.style.top || "0", 10);
        console.log('Storing position for chat:', chatId, { left: currentLeft, top: currentTop });
        console.log('Window current style.left:', window.style.left);
        console.log('Window current style.top:', window.style.top);
        setStoredPosition({ left: currentLeft, top: currentTop });

        // Find the chat window taskbar button specifically
        const taskbarButtons = document.querySelectorAll('.taskbar-button');
        console.log('Found taskbar buttons:', taskbarButtons.length);
        const chatButton = Array.from(taskbarButtons).find(button =>
            button.textContent.includes(recipientScreenname)
        );

        console.log('Chat button found for', recipientScreenname, ':', !!chatButton);

        if (chatButton) {
            const taskbarRect = chatButton.getBoundingClientRect();
            console.log('Taskbar button rect:', taskbarRect);

            // Calculate the target position (taskbar button position)
            const targetLeft = taskbarRect.left;
            const targetTop = taskbarRect.top;
            const targetWidth = taskbarRect.width;
            const targetHeight = taskbarRect.height;

            console.log('Animating chat to:', { left: targetLeft, top: targetTop, width: targetWidth, height: targetHeight });

            // Animate to taskbar button
            window.style.transition = 'all 0.3s ease-in-out';
            window.style.left = `${targetLeft}px`;
            window.style.top = `${targetTop}px`;
            window.style.width = `${targetWidth}px`;
            window.style.height = `${targetHeight}px`;

            // After animation completes, hide the window
            setTimeout(() => {
                window.style.visibility = 'hidden';
                window.style.transition = '';
                setIsAnimating(false);
                console.log('Minimize animation complete for chat:', chatId);
            }, 300);
        } else {
            // Fallback: just hide immediately
            console.log('No chat button found, hiding immediately');
            window.style.visibility = 'hidden';
            setIsAnimating(false);
        }
    };

    const animateRestore = () => {
        if (!winRef.current || isAnimating) return;

        console.log('Starting restore animation for chat:', chatId, 'stored position:', storedPosition);
        setIsAnimating(true);
        const window = winRef.current;

        // Find the chat window taskbar button specifically
        const taskbarButtons = document.querySelectorAll('.taskbar-button');
        const chatButton = Array.from(taskbarButtons).find(button =>
            button.textContent.includes(recipientScreenname)
        );

        if (chatButton && storedPosition) {
            const taskbarRect = chatButton.getBoundingClientRect();

            // First make window visible but at taskbar size
            window.style.visibility = 'visible';
            window.style.left = `${taskbarRect.left}px`;
            window.style.top = `${taskbarRect.top}px`;
            window.style.width = `${taskbarRect.width}px`;
            window.style.height = `${taskbarRect.height}px`;
            window.style.transition = 'all 0.3s ease-in-out';

            console.log('Restoring chat to position:', storedPosition);

            // Restore to stored position and size
            setTimeout(() => {
                window.style.left = `${storedPosition.left}px`;
                window.style.top = `${storedPosition.top}px`;
                window.style.width = '350px';
                window.style.height = '300px';

                setTimeout(() => {
                    window.style.transition = '';
                    setIsAnimating(false);
                    // Update the visible state so taskbar knows window is restored
                    setChatWindowVisible(chatId, true);
                    console.log('Restore animation complete for chat:', chatId);
                }, 300);
            }, 10);
        } else {
            // Fallback: just show normally
            console.log('No stored position or button, showing normally');
            console.log('Window current position:', { left: window.style.left, top: window.style.top });

            // If we have a stored position, use it even if we couldn't find the button
            if (storedPosition) {
                console.log('Using stored position for fallback:', storedPosition);
                window.style.left = `${storedPosition.left}px`;
                window.style.top = `${storedPosition.top}px`;
            }

            window.style.visibility = 'visible';
            setIsAnimating(false);
            // Update the visible state so taskbar knows window is restored
            setChatWindowVisible(chatId, true);
        }
    };

    // Handle visibility and positioning with animation
    useEffect(() => {
        console.log('ChatWindow visibility useEffect triggered:', { chatId, isVisible, isAnimating, hasBeenShownBefore });
        console.log('winRef.current:', !!winRef.current);

        // Reset isAnimating if it's stuck (safety mechanism)
        if (isAnimating && !winRef.current) {
            console.log('Resetting stuck isAnimating state');
            setIsAnimating(false);
        }

        if (winRef.current && !isAnimating) {
            console.log('ChatWindow: winRef exists and not animating, proceeding with visibility logic');
            if (isVisible) {
                if (!hasBeenShownBefore) {
                    // Initial show - position normally without animation
                    const currentLeft = winRef.current.style.left;
                    const currentTop = winRef.current.style.top;

                    // Only position the window if it doesn't have a position yet
                    if (!currentLeft || !currentTop || currentLeft === '0px' || currentTop === '0px') {
                        // Use the calculated position
                        winRef.current.style.left = windowPosition.left;
                        winRef.current.style.top = windowPosition.top;
                    }
                    winRef.current.style.visibility = "visible";
                    setHasBeenShownBefore(true);
                    // Bring chat window to front when initially shown
                    bringToFront(chatId);
                } else {
                    // Restore from minimize - use animation
                    animateRestore();
                }
            } else {
                // Minimize - use animation
                console.log('ChatWindow: About to minimize - calling animateMinimize');
                console.log('Current isAnimating state:', isAnimating);
                animateMinimize();
            }
        } else {
            console.log('ChatWindow: Skipping visibility logic - winRef:', !!winRef.current, 'isAnimating:', isAnimating);
        }
    }, [isVisible]);

    return (
        <div
            ref={winRef}
            id={`chat-window-${chatId}`}
            className="window w-[350px] h-[300px] absolute"
            style={{
                visibility: "visible",
                zIndex: getWindowZIndex(chatId),
                left: windowPosition.left,
                top: windowPosition.top
            }}
            onMouseDown={handleBringToFront}
        >
            <div className="title-bar chat-header" onMouseDown={handleMouseDown}>
                <div className="title-bar-text">
                    <img src="/ui/ico-chat.png" alt="" className="h-[16px] inline-block mb-[2px]" /> {recipientScreenname} - Instant Message
                </div>
                <div className="title-bar-controls">
                    <button
                        aria-label="Minimize"
                        onClick={() => {
                            console.log('Minimize button clicked for chat:', chatId);
                            animateMinimize();
                        }}
                    />
                    <button aria-label="Maximize" />
                    <button
                        aria-label="Close"
                        onClick={() => {
                            console.log('Close button clicked for chat:', chatId);
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
                                // Use proper cased screenname from cache if available, otherwise fall back to stored screenname
                                let senderScreenname = 'Unknown';
                                if (isMyMessage) {
                                    senderScreenname = currentUserScreenname || message.senderScreenname || 'Unknown';
                                } else {
                                    senderScreenname = senderScreennames[message.senderId] || message.senderScreenname || 'Unknown';
                                }
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
                    onClick={() => winRef.current?.querySelector('form')?.requestSubmit()}
                    onMouseEnter={(e) => e.target.src = "/ui/send2.png"}
                    onMouseLeave={(e) => e.target.src = "/ui/send1.png"}
                    onMouseDown={(e) => e.target.src = "/ui/send3.png"}
                    onMouseUp={(e) => e.target.src = "/ui/send2.png"}
                />
            </div>
        </div>
    );
}
