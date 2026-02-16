"use client";
import { useEffect, useRef, useState } from "react";
import { ref, onValue, off, set, get, update, push, remove } from "firebase/database";
import { signOut } from "firebase/auth";
import { database, auth } from "@/lib/firebase";
import { useWindowManager } from "@/context/WindowManagerContext";
import { useSoundVolume, getSoundVolume } from "@/context/SoundVolumeContext";

// If lastSeen is older than this, treat user as offline (fixes stale "online" entries in Firebase)
const STALE_ONLINE_MS = 2 * 60 * 1000; // 2 minutes

function isEffectivelyOnline(userData) {
    if (!userData || userData.online !== true) return false;
    const lastSeen = userData.lastSeen || 0;
    return (Date.now() - lastSeen) < STALE_ONLINE_MS;
}

export default function BuddyListWindow() {
    const { buddyListVisible, setBuddyListVisible, setLoginWindowVisible, openChatWindow, focusWindow, isWindowActive, currentUserScreenname, bringToFront, restorePreviousFocus, getWindowZIndex, isLoggedIn } = useWindowManager();
    useSoundVolume(); // for volume slider; playback uses getSoundVolume()
    const winRef = useRef(null);
    const hasBeenPositionedRef = useRef(false);
    const [allUsers, setAllUsers] = useState([]);
    const [myBuddies, setMyBuddies] = useState({});
    const [loading, setLoading] = useState(true);
    const [showAddBuddy, setShowAddBuddy] = useState(false);
    const [newBuddyScreenname, setNewBuddyScreenname] = useState("");
    const [selectedCategory, setSelectedCategory] = useState("buddies");
    const [collapsedSections, setCollapsedSections] = useState({
        buddies: false,
        family: false,
        coworkers: false,
        offline: false
    });
    const [selectedUser, setSelectedUser] = useState(null);
    const [selectedSection, setSelectedSection] = useState(null);
    const [isAnimating, setIsAnimating] = useState(false);
    const [hasBeenShownBefore, setHasBeenShownBefore] = useState(false);
    const [storedPosition, setStoredPosition] = useState(null);
    const [recentlySignedIn, setRecentlySignedIn] = useState(new Set());
    const [recentlySignedOut, setRecentlySignedOut] = useState(new Set());
    const [contextMenu, setContextMenu] = useState(null); // { x, y, buddy, category }
    const [, setStaleCheckTick] = useState(0); // Force re-render to re-evaluate stale-online

    // Refs for managing status listeners and timeouts
    const statusListenersRef = useRef(new Map());
    const previousStatusRef = useRef(new Map());
    const signInTimeoutsRef = useRef(new Map());
    const signOutTimeoutsRef = useRef(new Map());
    const firstSnapshotRef = useRef(new Map()); // Track first snapshot per buddy

    // Animation functions
    const animateMinimize = () => {
        if (!winRef.current || isAnimating) return;

        console.log('Starting minimize animation');
        setIsAnimating(true);
        const window = winRef.current;

        // Store current position before minimizing
        const currentLeft = parseInt(window.style.left || "0", 10);
        const currentTop = parseInt(window.style.top || "0", 10);
        console.log('Storing position:', { left: currentLeft, top: currentTop });
        setStoredPosition({ left: currentLeft, top: currentTop });

        // Find the buddy list taskbar button specifically
        const taskbarButtons = document.querySelectorAll('.taskbar-button');
        console.log('Found taskbar buttons:', taskbarButtons.length);
        const buddyListButton = Array.from(taskbarButtons).find(button =>
            button.textContent.includes("Buddy List") || button.textContent.includes("buddylist")
        );

        console.log('Buddy list button found:', !!buddyListButton);

        if (buddyListButton) {
            const taskbarRect = buddyListButton.getBoundingClientRect();
            console.log('Taskbar button rect:', taskbarRect);

            // Calculate the target position (taskbar button position)
            const targetLeft = taskbarRect.left;
            const targetTop = taskbarRect.top;
            const targetWidth = taskbarRect.width;
            const targetHeight = taskbarRect.height;

            console.log('Animating to:', { left: targetLeft, top: targetTop, width: targetWidth, height: targetHeight });

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
                console.log('Minimize animation complete');
            }, 300);
        } else {
            // Fallback: just hide immediately
            console.log('No buddy list button found, hiding immediately');
            window.style.visibility = 'hidden';
            setIsAnimating(false);
        }
    };

    const animateRestore = () => {
        if (!winRef.current || isAnimating) return;

        console.log('Starting restore animation, stored position:', storedPosition);
        setIsAnimating(true);
        const window = winRef.current;

        // Find the buddy list taskbar button specifically
        const taskbarButtons = document.querySelectorAll('.taskbar-button');
        const buddyListButton = Array.from(taskbarButtons).find(button =>
            button.textContent.includes("Buddy List") || button.textContent.includes("buddylist")
        );

        if (buddyListButton && storedPosition) {
            const taskbarRect = buddyListButton.getBoundingClientRect();

            // First make window visible but at taskbar size
            window.style.visibility = 'visible';
            window.style.left = `${taskbarRect.left}px`;
            window.style.top = `${taskbarRect.top}px`;
            window.style.width = `${taskbarRect.width}px`;
            window.style.height = `${taskbarRect.height}px`;
            window.style.transition = 'all 0.3s ease-in-out';

            console.log('Restoring to position:', storedPosition);

            // Restore to stored position and size
            setTimeout(() => {
                window.style.left = `${storedPosition.left}px`;
                window.style.top = `${storedPosition.top}px`;
                window.style.width = '220px';
                window.style.height = '550px';

                setTimeout(() => {
                    window.style.transition = '';
                    setIsAnimating(false);
                    console.log('Restore animation complete');
                }, 300);
            }, 10);
        } else {
            // Fallback: just show normally
            console.log('No stored position or button, showing normally');
            window.style.visibility = 'visible';
            setIsAnimating(false);
        }
    };

    // Function to preserve exact case from Firebase
    const preserveExactCase = (screenname) => {
        // Just return the screenname exactly as it comes from Firebase
        return screenname;
    };

    // Toggle section collapse/expand
    const toggleSection = (section) => {
        setCollapsedSections(prev => ({
            ...prev,
            [section]: !prev[section]
        }));
    };

    // Handle section header click
    const handleSectionClick = (section) => {
        setSelectedSection(section);
        setSelectedUser(null); // Clear user selection when selecting a section
    };

    // Handle opening chat window
    const handleUserClick = (user) => {
        openChatWindow(user.screenname, user.uid);
    };

    // Handle double-click to open chat window
    const handleUserDoubleClick = (user, e) => {
        e.stopPropagation(); // Prevent the single-click selection from being triggered
        openChatWindow(user.screenname, user.uid);
    };

    // Handle single-click to select user
    const handleUserSelect = (user) => {
        setSelectedUser(user.buddyId);
        setSelectedSection(null); // Clear section selection when selecting a user
    };

    // Handle clicking elsewhere to clear selection
    const handleContainerClick = (e) => {
        // Only clear if clicking on the container itself, not on user items
        if (e.target === e.currentTarget) {
            setSelectedUser(null);
            setSelectedSection(null);
        }
    };

    // Add buddy to list
    const handleAddBuddy = async () => {
        if (!newBuddyScreenname.trim() || !auth.currentUser) return;

        const screenname = newBuddyScreenname.trim();

        console.log('Adding buddy:', screenname);
        console.log('Available users:', allUsers);

        // First try to find user in allUsers array
        let userToAdd = allUsers.find(user =>
            user.screenname && user.screenname.toLowerCase() === screenname.toLowerCase()
        );

        if (!userToAdd) {
            console.log('User not found in allUsers array, trying direct Firebase lookup...');
            console.log('Searching for screenname:', screenname);

            // Try to find the user directly from Firebase by searching all users in status
            try {
                const statusRef = ref(database, 'status');
                const snapshot = await get(statusRef);

                if (snapshot.exists()) {
                    console.log('Firebase status data exists');
                    const statusData = snapshot.val();
                    const totalUsers = Object.keys(statusData).length;
                    console.log('Total users in status node:', totalUsers);

                    // Log all screennames we'll be searching through
                    console.log('All screennames in status node:');
                    Object.entries(statusData).forEach(([uid, userData]) => {
                        if (userData && userData.screenname) {
                            console.log(`  - ${uid}: "${userData.screenname}" (type: ${typeof userData.screenname})`);
                        } else {
                            console.log(`  - ${uid}: [no screenname or invalid data]`, userData);
                        }
                    });

                    // Search through all users in the status node to find matching screenname
                    const searchScreennameLower = screenname.toLowerCase().trim();
                    console.log('Searching for screenname (lowercase, trimmed):', `"${searchScreennameLower}"`);

                    for (const [uid, userData] of Object.entries(statusData)) {
                        if (userData && userData.screenname) {
                            // Handle different data types and trim/normalize
                            const dbScreenname = String(userData.screenname);
                            const dbScreennameLower = dbScreenname.toLowerCase().trim();
                            console.log(`Checking user ${uid}:`);
                            console.log(`  Original: "${dbScreenname}" (length: ${dbScreenname.length}, type: ${typeof userData.screenname})`);
                            console.log(`  Lowercase/trimmed: "${dbScreennameLower}"`);
                            console.log(`  Searching for: "${searchScreennameLower}"`);

                            // Case-insensitive comparison with trimming
                            if (dbScreennameLower === searchScreennameLower) {
                                userToAdd = {
                                    uid: uid,
                                    screenname: dbScreenname.trim(), // Use trimmed version to avoid issues
                                    lastSeen: userData.lastSeen || null,
                                    online: userData.online || false
                                };
                                console.log('✓✓✓ MATCH FOUND! ✓✓✓');
                                console.log('Found user via Firebase status search:', userToAdd);
                                break; // Found the user, exit the loop
                            } else {
                                console.log(`  ✗ No match: "${dbScreennameLower}" !== "${searchScreennameLower}"`);
                            }
                        } else {
                            console.log(`Skipping user ${uid}: no screenname field`, userData);
                        }
                    }

                    // If not found in status, try searching in users node as fallback
                    if (!userToAdd) {
                        console.log('Not found in status node, trying users node...');
                        try {
                            const usersRef = ref(database, 'users');
                            const usersSnapshot = await get(usersRef);

                            if (usersSnapshot.exists()) {
                                const usersData = usersSnapshot.val();
                                console.log('Total users in users node:', Object.keys(usersData).length);

                                for (const [uid, userData] of Object.entries(usersData)) {
                                    if (userData && userData.screenname) {
                                        const dbScreennameLower = String(userData.screenname).toLowerCase().trim();
                                        console.log(`Checking user ${uid} in users node: screenname="${userData.screenname}" (lowercase: "${dbScreennameLower}")`);
                                        // Case-insensitive comparison with trimming
                                        if (dbScreennameLower === searchScreennameLower) {
                                            // Get status data for this user if available
                                            let statusData = { online: false, lastSeen: null };
                                            try {
                                                const userStatusRef = ref(database, `status/${uid}`);
                                                const statusSnapshot = await get(userStatusRef);
                                                if (statusSnapshot.exists()) {
                                                    statusData = statusSnapshot.val();
                                                }
                                            } catch (e) {
                                                console.log('Could not fetch status for user:', uid);
                                            }

                                            userToAdd = {
                                                uid: uid,
                                                screenname: userData.screenname,
                                                lastSeen: statusData.lastSeen || null,
                                                online: statusData.online || false
                                            };
                                            console.log('✓ MATCH FOUND! Found user via Firebase users search:', userToAdd);
                                            break; // Found the user, exit the loop
                                        }
                                    }
                                }
                            }
                        } catch (usersError) {
                            console.log('Cannot search users node (permission denied - expected):', usersError.message);
                        }

                        if (!userToAdd) {
                            console.log('No user found with that screenname in Firebase (searched both status and users nodes)');
                        }
                    }
                } else {
                    console.log('No status data exists in Firebase');
                }
            } catch (error) {
                console.error('Error in direct Firebase lookup:', error);
                console.error('Error details:', error.message, error.code);
            }
        } else {
            console.log('Found user in allUsers array:', userToAdd);
        }

        if (!userToAdd) {
            alert("User not found. Make sure they have logged in at least once.");
            return;
        }

        // Check if already in buddy list
        const existingBuddy = Object.values(myBuddies).flat().find(buddy =>
            buddy.uid === userToAdd.uid
        );

        if (existingBuddy) {
            alert("This user is already in your buddy list!");
            return;
        }

        try {
            const buddyListRef = ref(database, `buddyLists/${auth.currentUser.uid}/${selectedCategory}`);
            await push(buddyListRef, {
                uid: userToAdd.uid,
                screenname: userToAdd.screenname,
                addedAt: Date.now()
            });

            setNewBuddyScreenname("");
            setShowAddBuddy(false);
            console.log('Successfully added buddy:', userToAdd.screenname);
        } catch (error) {
            console.error('Error adding buddy:', error);
            alert("Failed to add buddy. Please try again.");
        }
    };

    // Remove buddy from list
    const handleRemoveBuddy = async (buddyId, category) => {
        if (!auth.currentUser) return;

        try {
            const buddyRef = ref(database, `buddyLists/${auth.currentUser.uid}/${category}/${buddyId}`);
            await remove(buddyRef);
        } catch (error) {
            console.error('Error removing buddy:', error);
        }
    };

    // Right-click context menu for buddy rows
    const handleBuddyContextMenu = (e, buddy, category) => {
        e.preventDefault();
        e.stopPropagation();
        setSelectedUser(buddy.buddyId);
        setSelectedSection(null);
        setContextMenu({ x: e.clientX, y: e.clientY, buddy: { ...buddy, category }, category });
    };

    const closeContextMenu = () => setContextMenu(null);

    // Close context menu when clicking outside
    useEffect(() => {
        if (!contextMenu) return;
        const onDocClick = () => closeContextMenu();
        document.addEventListener("click", onDocClick);
        return () => document.removeEventListener("click", onDocClick);
    }, [contextMenu]);

    // Simple drag handler
    const handleMouseDown = (e) => {
        if (e.target.closest('.title-bar-controls')) return;

        // Mark that the window has been positioned by the user
        hasBeenPositionedRef.current = true;

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
            // Save position to localStorage when user finishes dragging
            if (winRef.current) {
                const left = parseInt(winRef.current.style.left || "0", 10);
                const top = parseInt(winRef.current.style.top || "0", 10);
                localStorage.setItem("buddy-list-position", JSON.stringify({ left, top }));
            }
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
        };

        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);
    };

    // Fetch buddy lists and set up real-time status listeners
    useEffect(() => {
        if (!buddyListVisible || !auth.currentUser) {
            // Clean up all listeners when window is hidden or user logs out
            statusListenersRef.current.forEach((unsubscribe) => {
                unsubscribe();
            });
            statusListenersRef.current.clear();
            previousStatusRef.current.clear();
            return;
        }

        const buddyListRef = ref(database, `buddyLists/${auth.currentUser.uid}`);

        const unsubscribeBuddyList = onValue(buddyListRef, async (snapshot) => {
            if (snapshot.exists()) {
                const buddyList = snapshot.val();
                console.log('Buddy list received:', buddyList);

                // Extract all unique UIDs from buddy list
                const buddyUids = new Set();
                Object.values(buddyList).forEach(category => {
                    if (category && typeof category === 'object') {
                        Object.values(category).forEach(buddy => {
                            if (buddy && buddy.uid) {
                                buddyUids.add(buddy.uid);
                            }
                        });
                    }
                });

                console.log('Buddy UIDs to monitor:', Array.from(buddyUids));

                // Clean up listeners for buddies no longer in the list
                statusListenersRef.current.forEach((unsubscribe, uid) => {
                    if (!buddyUids.has(uid)) {
                        unsubscribe();
                        statusListenersRef.current.delete(uid);
                        previousStatusRef.current.delete(uid);
                        // Clear any timeouts for this buddy
                        if (signInTimeoutsRef.current.has(uid)) {
                            clearTimeout(signInTimeoutsRef.current.get(uid));
                            signInTimeoutsRef.current.delete(uid);
                        }
                        if (signOutTimeoutsRef.current.has(uid)) {
                            clearTimeout(signOutTimeoutsRef.current.get(uid));
                            signOutTimeoutsRef.current.delete(uid);
                        }
                    }
                });

                // Set up real-time listeners for each buddy's status
                const users = [];

                for (const uid of buddyUids) {
                    // Track if this is the first time we're seeing this buddy's status
                    const isFirstForThisBuddy = !previousStatusRef.current.has(uid);
                    firstSnapshotRef.current.set(uid, isFirstForThisBuddy);

                    // Skip if listener already exists
                    if (statusListenersRef.current.has(uid)) {
                        // Still fetch initial status for display
                        try {
                            const userStatusRef = ref(database, `status/${uid}`);
                            const userSnapshot = await get(userStatusRef);
                            if (userSnapshot.exists()) {
                                const userData = userSnapshot.val();
                                if (userData && userData.screenname) {
                                    users.push({
                                        uid: uid,
                                        screenname: userData.screenname,
                                        lastSeen: userData.lastSeen,
                                        online: userData.online === true
                                    });
                                }
                            }
                        } catch (error) {
                            console.error(`Error fetching initial status for ${uid}:`, error);
                        }
                        continue;
                    }

                    const userStatusRef = ref(database, `status/${uid}`);
                    const unsubscribeStatus = onValue(userStatusRef, (statusSnapshot) => {
                        if (statusSnapshot.exists()) {
                            const userData = statusSnapshot.val();
                            if (userData && userData.screenname) {
                                const wasOnline = previousStatusRef.current.get(uid);
                                const isOnline = userData.online === true;
                                const isFirstForThisBuddy = firstSnapshotRef.current.get(uid);

                                // Update allUsers with the latest status
                                // Always update/add the user if we have a screenname, regardless of online status
                                setAllUsers(prev => {
                                    const index = prev.findIndex(u => u.uid === uid);
                                    if (index >= 0) {
                                        const updated = [...prev];
                                        updated[index] = {
                                            ...updated[index],
                                            online: isOnline,
                                            lastSeen: userData.lastSeen,
                                            screenname: userData.screenname // Always preserve proper-cased screenname
                                        };
                                        return updated;
                                    } else {
                                        // Add if not found - always add if we have screenname (even if offline)
                                        return [...prev, {
                                            uid: uid,
                                            screenname: userData.screenname, // Always use proper-cased screenname from Firebase
                                            lastSeen: userData.lastSeen || null,
                                            online: isOnline
                                        }];
                                    }
                                });

                                // Only trigger effects if it's not the first snapshot for this buddy and status changed
                                if (isFirstForThisBuddy === false && wasOnline !== undefined && wasOnline !== isOnline) {
                                    // Clear opposite effect immediately for mutual exclusivity
                                    if (isOnline) {
                                        // Buddy came online - clear any sign-out effects first
                                        setRecentlySignedOut(prev => {
                                            if (prev.has(uid)) {
                                                if (signOutTimeoutsRef.current.has(uid)) {
                                                    clearTimeout(signOutTimeoutsRef.current.get(uid));
                                                    signOutTimeoutsRef.current.delete(uid);
                                                }
                                                const next = new Set(prev);
                                                next.delete(uid);
                                                return next;
                                            }
                                            return prev;
                                        });
                                        // Play dooropen sound
                                        const doorOpenAudio = new Audio('/sounds/dooropen.wav');
                                        doorOpenAudio.volume = getSoundVolume();
                                        doorOpenAudio.play().catch(err => console.log('Error playing dooropen sound:', err));
                                        // Set sign-in effect for 8 seconds
                                        setRecentlySignedIn(prev => {
                                            const next = new Set(prev);
                                            next.add(uid);
                                            return next;
                                        });
                                        const timeoutId = setTimeout(() => {
                                            setRecentlySignedIn(prev => {
                                                const next = new Set(prev);
                                                next.delete(uid);
                                                return next;
                                            });
                                            signInTimeoutsRef.current.delete(uid);
                                        }, 8000);
                                        signInTimeoutsRef.current.set(uid, timeoutId);
                                    } else {
                                        // Buddy went offline - clear any sign-in effects first
                                        setRecentlySignedIn(prev => {
                                            if (prev.has(uid)) {
                                                if (signInTimeoutsRef.current.has(uid)) {
                                                    clearTimeout(signInTimeoutsRef.current.get(uid));
                                                    signInTimeoutsRef.current.delete(uid);
                                                }
                                                const next = new Set(prev);
                                                next.delete(uid);
                                                return next;
                                            }
                                            return prev;
                                        });
                                        // Play doorslam sound
                                        const doorSlamAudio = new Audio('/sounds/doorslam.wav');
                                        doorSlamAudio.volume = getSoundVolume();
                                        doorSlamAudio.play().catch(err => console.log('Error playing doorslam sound:', err));
                                        // Set sign-out effect for 8 seconds
                                        setRecentlySignedOut(prev => {
                                            const next = new Set(prev);
                                            next.add(uid);
                                            return next;
                                        });
                                        const timeoutId = setTimeout(() => {
                                            setRecentlySignedOut(prev => {
                                                const next = new Set(prev);
                                                next.delete(uid);
                                                return next;
                                            });
                                            signOutTimeoutsRef.current.delete(uid);
                                        }, 8000);
                                        signOutTimeoutsRef.current.set(uid, timeoutId);
                                    }
                                }

                                // Update previous status and mark that we've seen this buddy
                                previousStatusRef.current.set(uid, isOnline);
                                firstSnapshotRef.current.set(uid, false); // No longer first snapshot for this buddy
                            } else if (userData && userData.screenname) {
                                // Even if it's the first snapshot, update the status so next change will trigger effects
                                const isOnline = userData.online === true;
                                previousStatusRef.current.set(uid, isOnline);
                                firstSnapshotRef.current.set(uid, false); // Mark that we've processed the first snapshot
                            }
                        }
                    }, (error) => {
                        console.error(`Error listening to status for ${uid}:`, error);
                    });

                    statusListenersRef.current.set(uid, unsubscribeStatus);

                    // Fetch initial status
                    try {
                        const userSnapshot = await get(userStatusRef);
                        if (userSnapshot.exists()) {
                            const userData = userSnapshot.val();
                            if (userData && userData.screenname) {
                                users.push({
                                    uid: uid,
                                    screenname: userData.screenname,
                                    lastSeen: userData.lastSeen,
                                    online: userData.online === true
                                });
                                // Set initial previous status and mark that we've processed first snapshot
                                previousStatusRef.current.set(uid, userData.online === true);
                                firstSnapshotRef.current.set(uid, false);
                            }
                        }
                    } catch (error) {
                        console.error(`Error fetching initial status for ${uid}:`, error);
                    }
                }

                console.log('Setting allUsers (buddy list only):', users);
                setAllUsers(users);
                setMyBuddies(buddyList);
            } else {
                console.log('No buddy list found');
                setAllUsers([]);
                setMyBuddies({});
                // Clean up all listeners
                statusListenersRef.current.forEach((unsubscribe) => {
                    unsubscribe();
                });
                statusListenersRef.current.clear();
                previousStatusRef.current.clear();
            }
            setLoading(false);
        }, (error) => {
            console.error('Error fetching buddy list:', error);
            setLoading(false);
        });

        return () => {
            off(buddyListRef, 'value', unsubscribeBuddyList);
            // Clean up all status listeners
            statusListenersRef.current.forEach((unsubscribe) => {
                unsubscribe();
            });
            statusListenersRef.current.clear();
            previousStatusRef.current.clear();
            // Clean up all timeouts
            signInTimeoutsRef.current.forEach((timeoutId) => clearTimeout(timeoutId));
            signInTimeoutsRef.current.clear();
            signOutTimeoutsRef.current.forEach((timeoutId) => clearTimeout(timeoutId));
            signOutTimeoutsRef.current.clear();
        };
    }, [buddyListVisible, auth.currentUser]);

    // Reset hasBeenShownBefore when user logs out to ensure repositioning on next login
    useEffect(() => {
        if (!isLoggedIn) {
            setHasBeenShownBefore(false);
            // Clear saved position on logout (optional - remove if you want to keep position)
            // localStorage.removeItem("buddy-list-position");
        }
    }, [isLoggedIn]);

    // Handle visibility and positioning with animation
    useEffect(() => {
        console.log('BuddyListWindow visibility useEffect triggered:', { buddyListVisible, isAnimating, hasBeenShownBefore });
        if (winRef.current && !isAnimating) {
            console.log('BuddyListWindow: winRef exists and not animating, proceeding with visibility logic');
            if (buddyListVisible) {
                if (!hasBeenShownBefore) {
                    // Initial show - position normally without animation
                    const currentLeft = winRef.current.style.left;
                    const currentTop = winRef.current.style.top;

                    // Check for saved position first, then center, then default
                    const savedPosition = localStorage.getItem("buddy-list-position");
                    if (savedPosition) {
                        try {
                            const { left, top } = JSON.parse(savedPosition);
                            if (typeof left === "number" && typeof top === "number") {
                                winRef.current.style.left = `${left}px`;
                                winRef.current.style.top = `${top}px`;
                                hasBeenPositionedRef.current = true;
                            }
                        } catch (e) {
                            console.log("Error parsing saved buddy list position:", e);
                            // Fall through to center positioning
                        }
                    }

                    // Only position if we don't have a saved position
                    if (!savedPosition || !hasBeenPositionedRef.current) {
                        // Center the window
                        const rect = winRef.current.getBoundingClientRect();
                        const vw = window.innerWidth;
                        const vh = window.innerHeight;
                        const left = Math.max(0, Math.floor((vw - rect.width) / 2));
                        const top = Math.max(0, Math.floor((vh - rect.height) / 2));
                        winRef.current.style.left = `${left}px`;
                        winRef.current.style.top = `${top}px`;
                        hasBeenPositionedRef.current = true;
                    }
                    winRef.current.style.visibility = "visible";
                    setHasBeenShownBefore(true);
                    // Bring buddy list to front when initially shown
                    bringToFront('buddylist');
                } else {
                    // Restore from minimize - use animation
                    animateRestore();
                }
            } else {
                // Minimize - use animation
                console.log('BuddyListWindow: About to minimize, calling animateMinimize');
                animateMinimize();
            }
        } else {
            console.log('BuddyListWindow: Skipping visibility logic - winRef:', !!winRef.current, 'isAnimating:', isAnimating);
        }
    }, [buddyListVisible]); // Only depend on buddyListVisible, not bringToFront

    // Re-check stale online status every 60s when buddy list is visible
    useEffect(() => {
        if (!buddyListVisible) return;
        const interval = setInterval(() => setStaleCheckTick((t) => t + 1), 60000);
        return () => clearInterval(interval);
    }, [buddyListVisible]);

    // Helper function to get buddy list with online status
    const getBuddyListWithStatus = (category) => {
        if (!myBuddies[category]) return [];

        return Object.entries(myBuddies[category]).map(([buddyId, buddyData]) => {
            const userData = allUsers.find(user => user.uid === buddyData.uid);
            // Always prefer screenname from Firebase status (userData) to ensure proper casing
            // Only fall back to buddyData.screenname if userData doesn't exist AND buddyData.screenname exists
            const screenname = userData?.screenname || (buddyData?.screenname ? buddyData.screenname : 'Unknown');
            return {
                ...buddyData,
                buddyId,
                screenname: screenname, // Use correct screenname from status to preserve casing
                online: isEffectivelyOnline(userData),
                lastSeen: userData ? userData.lastSeen : null
            };
        }).sort((a, b) => a.screenname.localeCompare(b.screenname));
    };

    // Helper function to get online buddies only
    // Keep recently signed out buddies in the online section during the effect
    const getOnlineBuddies = (category) => {
        return getBuddyListWithStatus(category).filter(buddy =>
            buddy.online || recentlySignedOut.has(buddy.uid)
        );
    };

    // Helper function to get offline buddies only
    // Exclude recently signed out buddies (they're still showing in online section)
    const getOfflineBuddies = (category) => {
        return getBuddyListWithStatus(category).filter(buddy =>
            !buddy.online && !recentlySignedOut.has(buddy.uid)
        );
    };

    // Get counts for each category
    const getCategoryCounts = () => {
        const allBuddies = getBuddyListWithStatus('buddies');
        const allFamily = getBuddyListWithStatus('family');
        const allCoworkers = getBuddyListWithStatus('coworkers');
        const onlineBuddies = getOnlineBuddies('buddies');
        const onlineFamily = getOnlineBuddies('family');
        const onlineCoworkers = getOnlineBuddies('coworkers');
        const offlineBuddies = getOfflineBuddies('buddies');
        const offlineFamily = getOfflineBuddies('family');
        const offlineCoworkers = getOfflineBuddies('coworkers');
        const allOfflineBuddies = [...offlineBuddies, ...offlineFamily, ...offlineCoworkers];
        const totalAllBuddies = [...allBuddies, ...allFamily, ...allCoworkers];

        return {
            buddies: {
                total: allBuddies.length,
                online: onlineBuddies.length
            },
            family: {
                total: allFamily.length,
                online: onlineFamily.length
            },
            coworkers: {
                total: allCoworkers.length,
                online: onlineCoworkers.length
            },
            offline: {
                total: totalAllBuddies.length,
                offline: allOfflineBuddies.length
            }
        };
    };

    const counts = getCategoryCounts();

    // Don't render if user is not logged in
    if (!isLoggedIn) {
        return null;
    }

    return (
        <>
            <div
                ref={winRef}
                id="buddylist-window"
                className={`window w-[220px] h-[550px] absolute ${!isWindowActive('buddylist') ? 'window-inactive' : ''}`}
                style={{
                    visibility: "visible",
                    zIndex: getWindowZIndex('buddylist')
                }}
                onMouseDown={() => bringToFront('buddylist')}
            >
                <div className="title-bar buddylist-header" onMouseDown={handleMouseDown}>
                    <div className="title-bar-text">
                        <img src="/ui/ico-buddylist.png" alt="" className="h-[16px] inline-block" /> {currentUserScreenname}'s Buddy List
                    </div>
                    <div className="title-bar-controls">
                        <button aria-label="Minimize" onClick={() => setBuddyListVisible(false)} />
                        <button aria-label="Maximize" />
                        <button
                            aria-label="Close"
                            onClick={() => {
                                setBuddyListVisible(false);
                                restorePreviousFocus();
                            }}
                        />
                    </div>
                </div>

                <div className="window-body" onClick={handleContainerClick}>
                    {/* Menu Toolbar */}
                    <div className="py-0.5 px-2 flex items-center gap-2 menu-toolbar">
                        <span className="pixelated-font">My AIM</span>
                        <span className="pixelated-font">People</span>
                        <span className="pixelated-font">Help</span>
                    </div>

                    <div className="bg-[#fffcef] flex justify-center mb-[1px]">
                        <img src="/ui/bl-header.png" alt="AIM" className="" />
                    </div>

                    {loading ? (
                        <div className="text-sm text-gray-600 py-2">Loading buddies...</div>
                    ) : (
                        <>
                            {/* Buddies Section */}

                            <div className="bg-white p-1 min-h-[300px] xp-border" style={{ backgroundImage: 'url(/ui/bl-bg.png)', backgroundSize: '150px auto', backgroundPosition: 'center', backgroundRepeat: 'no-repeat' }}>

                                <div
                                    className={`text-sm font-bold cursor-pointer flex items-center user-item border border-transparent`}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        handleSectionClick('buddies');
                                        toggleSection('buddies');
                                    }}
                                >
                                    <img
                                        src="/ui/bl-arrow.png"
                                        alt=""
                                        className={`w-[14px] mr-1 ${collapsedSections.buddies ? 'rotate-[-90deg]' : ''}`}
                                    />
                                    <span className={selectedSection === 'buddies' ? 'selected-user' : ''}>
                                        Buddies ({counts.buddies.online}/{counts.buddies.total})
                                    </span>
                                </div>

                                {!collapsedSections.buddies && getOnlineBuddies('buddies').length > 0 && (
                                    <div className="space-y-0">
                                        {getOnlineBuddies('buddies').map((buddy) => (
                                            <div
                                                key={buddy.buddyId}
                                                className={`flex items-center justify-between cursor-pointer border border-transparent user-item`}
                                                onClick={() => handleUserSelect(buddy)}
                                                onContextMenu={(e) => handleBuddyContextMenu(e, buddy, 'buddies')}
                                            >
                                                <div
                                                    className="flex items-center flex-1"
                                                    onDoubleClick={(e) => handleUserDoubleClick(buddy, e)}
                                                >
                                                    <span className="mr-1 text-black inline-block w-4 text-center">
                                                        {/* Empty space to align with arrow */}
                                                    </span>
                                                    {recentlySignedOut.has(buddy.uid) ? (
                                                        <img
                                                            src="/ui/doorclose.png"
                                                            alt=""
                                                            className="h-[12px] w-[12px] mr-1"
                                                        />
                                                    ) : recentlySignedIn.has(buddy.uid) ? (
                                                        <img
                                                            src="/ui/dooropen.png"
                                                            alt=""
                                                            className="h-[12px] w-[12px] mr-1"
                                                        />
                                                    ) : null}
                                                    <span
                                                        className={`text-sm ${recentlySignedOut.has(buddy.uid)
                                                            ? 'font-medium text-[#a29e8f] italic'
                                                            : recentlySignedIn.has(buddy.uid)
                                                                ? 'font-bold text-[#000000]'
                                                                : (buddy.online ? 'font-medium text-[#000000]' : 'font-medium text-[#a29e8f] italic')
                                                            } ${selectedUser === buddy.buddyId ? 'selected-user' : ''}`}
                                                        data-original-screenname={buddy.screenname}
                                                        data-screenname-lower={buddy.screenname.toLowerCase()}
                                                        style={{ textTransform: 'none !important' }}
                                                    >
                                                        {buddy.screenname}
                                                    </span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}

                                {/* Family Section */}
                                <div
                                    className={`text-sm font-bold mb-1 mt-1 cursor-pointer flex items-center user-item border border-transparent`}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        handleSectionClick('family');
                                        toggleSection('family');
                                    }}
                                >
                                    <img
                                        src="/ui/bl-arrow.png"
                                        alt=""
                                        className={`w-[14px] mr-1 ${collapsedSections.family ? 'rotate-[-90deg]' : ''}`}
                                    />
                                    <span className={selectedSection === 'family' ? 'selected-user' : ''}>
                                        Family ({counts.family.online}/{counts.family.total})
                                    </span>
                                </div>

                                {!collapsedSections.family && getOnlineBuddies('family').length > 0 && (
                                    <div className="space-y-0 mb-3">
                                        {getOnlineBuddies('family').map((buddy) => (
                                            <div
                                                key={buddy.buddyId}
                                                className={`flex items-center justify-between cursor-pointer border border-transparent user-item`}
                                                onClick={() => handleUserSelect(buddy)}
                                                onContextMenu={(e) => handleBuddyContextMenu(e, buddy, 'family')}
                                            >
                                                <div
                                                    className="flex items-center flex-1"
                                                    onDoubleClick={(e) => handleUserDoubleClick(buddy, e)}
                                                >
                                                    <span className="mr-1 text-black inline-block w-4 text-center">
                                                        {/* Empty space to align with arrow */}
                                                    </span>
                                                    {recentlySignedOut.has(buddy.uid) ? (
                                                        <img
                                                            src="/ui/doorclose.png"
                                                            alt=""
                                                            className="h-[12px] w-[12px] mr-1"
                                                        />
                                                    ) : recentlySignedIn.has(buddy.uid) ? (
                                                        <img
                                                            src="/ui/dooropen.png"
                                                            alt=""
                                                            className="h-[12px] w-[12px] mr-1"
                                                        />
                                                    ) : null}
                                                    <span
                                                        className={`text-sm ${recentlySignedOut.has(buddy.uid)
                                                            ? 'font-medium text-[#a29e8f] italic'
                                                            : recentlySignedIn.has(buddy.uid)
                                                                ? 'font-bold text-[#000000]'
                                                                : (buddy.online ? 'font-medium text-[#000000]' : 'font-medium text-[#a29e8f] italic')
                                                            } ${selectedUser === buddy.buddyId ? 'selected-user' : ''}`}
                                                        data-original-screenname={buddy.screenname}
                                                        data-screenname-lower={buddy.screenname.toLowerCase()}
                                                        style={{ textTransform: 'none !important' }}
                                                    >
                                                        {buddy.screenname}
                                                    </span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}

                                {/* Co-Workers Section */}
                                <div
                                    className={`text-sm font-bold mb-1 mt-1 cursor-pointer flex items-center user-item border border-transparent`}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        handleSectionClick('coworkers');
                                        toggleSection('coworkers');
                                    }}
                                >
                                    <img
                                        src="/ui/bl-arrow.png"
                                        alt=""
                                        className={`w-[14px] mr-1 ${collapsedSections.coworkers ? 'rotate-[-90deg]' : ''}`}
                                    />
                                    <span className={selectedSection === 'coworkers' ? 'selected-user' : ''}>
                                        Co-Workers ({counts.coworkers.online}/{counts.coworkers.total})
                                    </span>
                                </div>

                                {!collapsedSections.coworkers && getOnlineBuddies('coworkers').length > 0 && (
                                    <div className="space-y-0 mb-3">
                                        {getOnlineBuddies('coworkers').map((buddy) => (
                                            <div
                                                key={buddy.buddyId}
                                                className={`flex items-center justify-between cursor-pointer border border-transparent user-item`}
                                                onClick={() => handleUserSelect(buddy)}
                                                onContextMenu={(e) => handleBuddyContextMenu(e, buddy, 'coworkers')}
                                            >
                                                <div
                                                    className="flex items-center flex-1"
                                                    onDoubleClick={(e) => handleUserDoubleClick(buddy, e)}
                                                >
                                                    <span className="mr-1 text-black inline-block w-4 text-center">
                                                        {/* Empty space to align with arrow */}
                                                    </span>
                                                    {recentlySignedOut.has(buddy.uid) ? (
                                                        <img
                                                            src="/ui/doorclose.png"
                                                            alt=""
                                                            className="h-[12px] w-[12px] mr-1"
                                                        />
                                                    ) : recentlySignedIn.has(buddy.uid) ? (
                                                        <img
                                                            src="/ui/dooropen.png"
                                                            alt=""
                                                            className="h-[12px] w-[12px] mr-1"
                                                        />
                                                    ) : null}
                                                    <span
                                                        className={`text-sm ${recentlySignedOut.has(buddy.uid)
                                                            ? 'font-medium text-[#a29e8f] italic'
                                                            : recentlySignedIn.has(buddy.uid)
                                                                ? 'font-bold text-[#000000]'
                                                                : (buddy.online ? 'font-medium text-[#000000]' : 'font-medium text-[#a29e8f] italic')
                                                            } ${selectedUser === buddy.buddyId ? 'selected-user' : ''}`}
                                                        data-original-screenname={buddy.screenname}
                                                        data-screenname-lower={buddy.screenname.toLowerCase()}
                                                        style={{ textTransform: 'none !important' }}
                                                    >
                                                        {buddy.screenname}
                                                    </span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}

                                {/* Offline Section */}
                                <div
                                    className={`text-sm text-[#a29e8f] font-bold mb-0 mt-1 cursor-pointer flex items-center user-item border border-transparent`}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        handleSectionClick('offline');
                                        toggleSection('offline');
                                    }}
                                >
                                    <img
                                        src="/ui/bl-arrow.png"
                                        alt=""
                                        className={`w-[14px] mr-1 ${collapsedSections.offline ? 'rotate-[-90deg]' : ''}`}
                                    />
                                    <span className={selectedSection === 'offline' ? 'selected-user' : ''}>
                                        Offline ({counts.offline.offline}/{counts.offline.total})
                                    </span>
                                </div>

                                {!collapsedSections.offline && (() => {
                                    const offlineBuddies = [
                                        ...getOfflineBuddies('buddies').map((b) => ({ ...b, category: 'buddies' })),
                                        ...getOfflineBuddies('family').map((b) => ({ ...b, category: 'family' })),
                                        ...getOfflineBuddies('coworkers').map((b) => ({ ...b, category: 'coworkers' }))
                                    ].sort((a, b) => a.screenname.localeCompare(b.screenname));
                                    return (
                                        <div className="space-y-0 mb-3">
                                            {offlineBuddies.length > 0 && offlineBuddies.map((buddy) => (
                                                <div
                                                    key={`${buddy.category}-${buddy.buddyId}`}
                                                    className={`flex items-center cursor-pointer border border-transparent user-item`}
                                                    onClick={() => handleUserSelect(buddy)}
                                                    onDoubleClick={(e) => handleUserDoubleClick(buddy, e)}
                                                    onContextMenu={(e) => handleBuddyContextMenu(e, buddy, buddy.category)}
                                                >
                                                    <span className="mr-1 text-black inline-block w-4 text-center">
                                                        {/* Empty space to align with arrow */}
                                                    </span>
                                                    <span
                                                        className={`text-sm font-medium text-[#a29e8f] italic ${selectedUser === buddy.buddyId ? 'selected-user' : ''}`}
                                                        data-original-screenname={buddy.screenname}
                                                        data-screenname-lower={buddy.screenname.toLowerCase()}
                                                        style={{ textTransform: 'none !important' }}
                                                    >
                                                        {buddy.screenname}
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                    );
                                })()}
                            </div>
                        </>
                    )}

                    {/* Add Buddy Section (bottom) */}
                    <div className="my-2">
                        <button
                            onClick={() => setShowAddBuddy(!showAddBuddy)}
                            className="w-full px-3 py-1 bg-[#d4d0c8] text-black hover:bg-[#c0c0c0] border border-[#808080] border-t-[#ffffff] border-l-[#ffffff] pixelated-font"
                        >
                            {showAddBuddy ? "Cancel" : "Add Buddy"}
                        </button>

                        {showAddBuddy && (
                            <div className="mt-2 space-y-2">
                                <input
                                    type="text"
                                    value={newBuddyScreenname}
                                    onChange={(e) => setNewBuddyScreenname(e.target.value)}
                                    placeholder="Enter screenname"
                                    className="w-full px-2 py-1 text-sm border border-[#808080] focus:outline-none"
                                    onKeyPress={(e) => e.key === 'Enter' && handleAddBuddy()}
                                />
                                <select
                                    value={selectedCategory}
                                    onChange={(e) => setSelectedCategory(e.target.value)}
                                    className="w-full px-2 py-1 text-sm border border-[#808080] focus:outline-none"
                                >
                                    <option value="buddies">Buddies</option>
                                    <option value="family">Family</option>
                                    <option value="coworkers">Co-Workers</option>
                                </select>
                                <button
                                    onClick={handleAddBuddy}
                                    className="w-full px-3 py-1 bg-[#d4d0c8] text-black hover:bg-[#c0c0c0] border border-[#808080] border-t-[#ffffff] border-l-[#ffffff] pixelated-font"
                                >
                                    Add
                                </button>
                            </div>
                        )}
                    </div>

                    <button
                        onClick={async () => {
                            try {
                                // Set offline status before signing out
                                if (auth.currentUser) {
                                    const userStatusRef = ref(database, `status/${auth.currentUser.uid}`);
                                    await set(userStatusRef, {
                                        online: false,
                                        lastSeen: Date.now(),
                                        screenname: auth.currentUser.email?.split('@')[0] || 'unknown'
                                    });
                                    console.log('Set offline status on sign out for user:', auth.currentUser.uid);
                                }
                            } catch (error) {
                                console.log('Error setting offline status on sign out:', error);
                            }

                            await signOut(auth);
                            setBuddyListVisible(false);
                            setLoginWindowVisible(true);
                        }}
                        className="w-full px-3 py-1 text-sm bg-[#d4d0c8] text-black hover:bg-[#c0c0c0] border border-[#808080] border-t-[#ffffff] border-l-[#ffffff]"
                    >
                        Sign Out
                    </button>
                </div>
            </div>

            {contextMenu && (
                <div
                    className="fixed bg-[#d4d0c8] border border-[#808080] border-t-[#ffffff] border-l-[#ffffff] shadow-lg py-0.5 min-w-[160px] pixelated-font text-sm z-[9999]"
                    style={{ left: contextMenu.x, top: contextMenu.y }}
                    onClick={(e) => e.stopPropagation()}
                >
                    <button
                        type="button"
                        className="w-full text-left px-3 py-1.5 hover:bg-[#0a246a] hover:text-white block"
                        onClick={() => {
                            openChatWindow(contextMenu.buddy.screenname, contextMenu.buddy.uid);
                            closeContextMenu();
                        }}
                    >
                        Send instant message
                    </button>
                    <button
                        type="button"
                        className="w-full text-left px-3 py-1.5 hover:bg-[#0a246a] hover:text-white block text-red-700"
                        onClick={() => {
                            handleRemoveBuddy(contextMenu.buddy.buddyId, contextMenu.category);
                            closeContextMenu();
                        }}
                    >
                        Remove from buddy list
                    </button>
                </div>
            )}
        </>
    );
}