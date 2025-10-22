"use client";

import { createContext, useContext, useState, useEffect, useRef } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { ref, onValue } from "firebase/database";
import { auth, database } from "@/lib/firebase";

const WindowManagerContext = createContext(undefined);

export function WindowManagerProvider({ children }) {
    const [loginWindowVisible, setLoginWindowVisible] = useState(true);
    const [buddyListVisible, setBuddyListVisible] = useState(false);
    const [isLoggedIn, setIsLoggedIn] = useState(false);
    const [chatWindows, setChatWindows] = useState([]);
    const [currentUser, setCurrentUser] = useState(null);
    const [currentUserScreenname, setCurrentUserScreenname] = useState('User');
    const [activeWindow, setActiveWindow] = useState(null);
    const [focusHistory, setFocusHistory] = useState([]); // Track which window is currently active
    const [windowZIndex, setWindowZIndex] = useState({}); // Track z-index for each window
    const chatWindowsRef = useRef([]); // Use ref to avoid dependency issues
    const lastProcessedMessageRef = useRef({}); // Track last processed message per chat room
    const loginTimestampRef = useRef(null); // Track when user logged in

    // Update ref whenever chatWindows changes
    useEffect(() => {
        chatWindowsRef.current = chatWindows;
    }, [chatWindows]);

    // Chat window management functions
    const openChatWindow = (recipientScreenname, recipientUid) => {
        console.log('openChatWindow called with:', recipientScreenname, recipientUid);

        // Check if a chat window already exists for this user
        const existingChat = chatWindows.find(chat => chat.recipientUid === recipientUid);

        if (existingChat) {
            console.log('Chat window already exists for:', recipientScreenname, '- bringing to front');
            // Bring existing window to front by updating its visibility
            setChatWindows(prev => prev.map(chat =>
                chat.id === existingChat.id ? { ...chat, visible: true } : chat
            ));
            // Focus the existing window
            setActiveWindow(existingChat.id);
            return;
        }

        // Create new chat window if none exists
        const chatId = `${recipientUid}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        setChatWindows(prev => {
            const newChats = [...prev, {
                id: chatId,
                recipientScreenname,
                recipientUid,
                visible: true
            }];
            console.log('Created new chat window:', newChats);
            return newChats;
        });
        // Focus the new window
        setActiveWindow(chatId);
    };

    const closeChatWindow = (chatId) => {
        setChatWindows(prev => prev.filter(chat => chat.id !== chatId));
    };

    const setChatWindowVisible = (chatId, visible) => {
        setChatWindows(prev => prev.map(chat =>
            chat.id === chatId ? { ...chat, visible } : chat
        ));
    };

    // Window focus management functions
    const focusWindow = (windowId) => {
        setActiveWindow(windowId);
    };

    const isWindowActive = (windowId) => {
        return activeWindow === windowId;
    };

    const bringToFront = (windowId) => {
        setActiveWindow(windowId);

        // Update focus history - remove if already exists, then add to end
        setFocusHistory(prev => {
            const filtered = prev.filter(id => id !== windowId);
            return [...filtered, windowId];
        });

        // Update z-index - give the focused window the highest z-index
        setWindowZIndex(prev => {
            const newZIndex = { ...prev };
            // Find the current highest z-index
            const maxZIndex = Math.max(...Object.values(newZIndex), 50);
            // Set the focused window to be above all others
            newZIndex[windowId] = maxZIndex + 1;
            return newZIndex;
        });
    };

    const restorePreviousFocus = () => {
        setFocusHistory(prev => {
            if (prev.length <= 1) {
                // No previous window to restore
                setActiveWindow(null);
                return [];
            }

            // Remove the last (current) window and set the previous one as active
            const newHistory = prev.slice(0, -1);
            const previousWindow = newHistory[newHistory.length - 1];
            setActiveWindow(previousWindow);
            return newHistory;
        });
    };

    const getWindowZIndex = (windowId) => {
        return windowZIndex[windowId] || 50; // Default to 50 if not set
    };

    // Track authentication state
    useEffect(() => {
        console.log('Setting up auth state listener...');

        const unsubscribe = onAuthStateChanged(auth, (user) => {
            console.log('Auth state changed:', user ? 'User logged in' : 'No user');
            setIsLoggedIn(!!user);
            setCurrentUser(user);

            // Show appropriate window based on auth state
            if (user) {
                console.log('Hiding login window, showing buddy list');
                setLoginWindowVisible(false);
                setBuddyListVisible(true);
                loginTimestampRef.current = Date.now(); // Set login timestamp
                console.log('Login timestamp set:', loginTimestampRef.current);

                // Fetch current user's screenname from Firebase
                const userStatusRef = ref(database, `status/${user.uid}`);
                console.log('Setting up Firebase listener for user:', user.uid);
                onValue(userStatusRef, (snapshot) => {
                    console.log('Firebase snapshot for current user:', snapshot.exists() ? snapshot.val() : 'No data');
                    if (snapshot.exists()) {
                        const userData = snapshot.val();
                        if (userData.screenname) {
                            console.log('Setting current user screenname from Firebase:', userData.screenname);
                            console.log('Screenname type:', typeof userData.screenname);
                            console.log('Screenname length:', userData.screenname.length);
                            console.log('Current screenname before setting:', currentUserScreenname);
                            console.log('=== WINDOW MANAGER CONTEXT DEBUG ===');
                            console.log('Firebase userData:', userData);
                            console.log('About to set screenname to:', userData.screenname);
                            console.log('=== END WINDOW MANAGER DEBUG ===');
                            setCurrentUserScreenname(userData.screenname);

                            // Debug: Check what was actually set
                            setTimeout(() => {
                                console.log('=== SCREENNAME SET DEBUG ===');
                                console.log('currentUserScreenname after set:', currentUserScreenname);
                                console.log('=== END SCREENNAME SET DEBUG ===');
                            }, 100);
                        } else {
                            // Only use email fallback if we don't already have a screenname set
                            const currentScreenname = currentUserScreenname;
                            if (currentScreenname === 'User' || !currentScreenname) {
                                const emailScreenname = user.email?.split('@')[0] || 'User';
                                console.log('Setting current user screenname from email (no Firebase screenname):', emailScreenname);
                                setCurrentUserScreenname(emailScreenname);
                            } else {
                                console.log('Keeping existing screenname:', currentScreenname);
                            }
                        }
                    } else {
                        // Only use email fallback if we don't already have a screenname set
                        const currentScreenname = currentUserScreenname;
                        if (currentScreenname === 'User' || !currentScreenname) {
                            const emailScreenname = user.email?.split('@')[0] || 'User';
                            console.log('Setting current user screenname from email (no Firebase data):', emailScreenname);
                            setCurrentUserScreenname(emailScreenname);
                        } else {
                            console.log('Keeping existing screenname (no Firebase data):', currentScreenname);
                        }
                    }
                });
            } else {
                console.log('Showing login window, hiding buddy list');
                setLoginWindowVisible(true);
                setBuddyListVisible(false);
                setChatWindows([]); // Close all chat windows on logout
                loginTimestampRef.current = null; // Clear login timestamp
                setCurrentUserScreenname('User'); // Reset screenname
            }
        });

        return () => unsubscribe();
    }, []);

    // Listen for incoming messages and auto-open chat windows
    useEffect(() => {
        console.log('=== MESSAGE LISTENER DEBUG START ===');
        console.log('Message listener useEffect triggered');
        console.log('currentUser:', currentUser);
        console.log('chatWindows:', chatWindows);

        if (!currentUser) {
            console.log('No current user, skipping message listener setup');
            console.log('=== MESSAGE LISTENER DEBUG END ===');
            return;
        }

        console.log('Setting up simple message listener for user:', currentUser.uid);

        // Use a simpler approach - just listen to the chats path and filter in the callback
        const allChatsRef = ref(database, 'chats');
        console.log('Created ref to:', 'chats');

        const unsubscribe = onValue(allChatsRef, (snapshot) => {
            console.log('=== MESSAGE LISTENER TRIGGERED ===');
            console.log('Message listener triggered - checking for new messages');

            if (!snapshot.exists()) {
                console.log('No chats exist yet');
                return;
            }

            const chats = snapshot.val();
            console.log('All chats:', chats);

            // Check each chat room for new messages
            Object.keys(chats).forEach(chatRoomId => {
                const chat = chats[chatRoomId];

                // Only process chat rooms that contain the current user
                if (!chatRoomId.includes(currentUser.uid)) {
                    console.log(`Skipping chat room ${chatRoomId} - doesn't contain current user`);
                    return;
                }

                console.log(`Checking chat room: ${chatRoomId}`, chat);

                if (chat.messages) {
                    const messages = Object.values(chat.messages);
                    console.log(`Chat ${chatRoomId} has ${messages.length} messages`);

                    // Find the most recent message
                    const latestMessage = messages[messages.length - 1];
                    console.log('Latest message:', latestMessage);
                    console.log('Current user UID:', currentUser.uid);
                    console.log('Message recipientId:', latestMessage?.recipientId);
                    console.log('UIDs match?', latestMessage?.recipientId === currentUser.uid);

                    // Check if we've already processed this message
                    const lastProcessed = lastProcessedMessageRef.current[chatRoomId];
                    const isNewMessage = !lastProcessed || latestMessage.timestamp > lastProcessed;

                    // Only process messages sent after the user logged in
                    const isAfterLogin = loginTimestampRef.current && latestMessage.timestamp > loginTimestampRef.current;

                    // Only process if this message is for the current user AND it's new AND it was sent after login
                    if (latestMessage && latestMessage.recipientId === currentUser.uid && isNewMessage && isAfterLogin) {
                        console.log('Found new message for current user:', latestMessage);
                        console.log('Message timestamp:', latestMessage.timestamp);
                        console.log('Login timestamp:', loginTimestampRef.current);
                        console.log('Message sent after login:', isAfterLogin);

                        // Update the last processed timestamp for this chat room
                        lastProcessedMessageRef.current[chatRoomId] = latestMessage.timestamp;

                        // Check if this chat window is already open
                        const isAlreadyOpen = chatWindowsRef.current.some(chat =>
                            chat.recipientUid === latestMessage.senderId
                        );

                        if (!isAlreadyOpen) {
                            console.log('Opening new chat window for:', latestMessage.senderScreenname);
                            openChatWindow(latestMessage.senderScreenname, latestMessage.senderId);
                        } else {
                            console.log('Chat window already open for:', latestMessage.senderScreenname);
                        }
                    } else {
                        console.log('Message not for current user, already processed, or sent before login:', {
                            recipientId: latestMessage?.recipientId,
                            currentUser: currentUser.uid,
                            isNew: isNewMessage,
                            isAfterLogin: isAfterLogin,
                            lastProcessed: lastProcessed,
                            currentTimestamp: latestMessage?.timestamp,
                            loginTimestamp: loginTimestampRef.current
                        });
                    }
                } else {
                    console.log(`Chat ${chatRoomId} has no messages`);
                }
            });
        });

        console.log('Message listener setup complete');

        return () => {
            console.log('Cleaning up message listener');
            unsubscribe();
        };
    }, [currentUser]); // Remove chatWindows from dependencies to prevent recreation

    return (
        <WindowManagerContext.Provider
            value={{
                loginWindowVisible,
                setLoginWindowVisible,
                buddyListVisible,
                setBuddyListVisible,
                isLoggedIn,
                setIsLoggedIn,
                chatWindows,
                openChatWindow,
                closeChatWindow,
                setChatWindowVisible,
                activeWindow,
                focusWindow,
                isWindowActive,
                bringToFront,
                restorePreviousFocus,
                getWindowZIndex,
                currentUserScreenname,
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