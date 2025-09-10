"use client";
import { useEffect, useRef, useState } from "react";
import { ref, onValue, off, set, get, update, push, remove } from "firebase/database";
import { signOut } from "firebase/auth";
import { database, auth } from "@/lib/firebase";
import { useWindowManager } from "@/context/WindowManagerContext";

export default function BuddyListWindow() {
    const { buddyListVisible, setBuddyListVisible, setLoginWindowVisible, openChatWindow, focusWindow, isWindowActive, currentUserScreenname } = useWindowManager();
    const winRef = useRef(null);
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

            // Try to find the user directly from Firebase
            try {
                const statusRef = ref(database, 'status');
                const snapshot = await get(statusRef);

                if (snapshot.exists()) {
                    console.log('Firebase status data:', snapshot.val());

                    // Create a simple mapping for testing - you can update this as needed
                    const screennameToUid = {
                        'user1': 'ovyk5WB4AEbNXjDH4yIOyg6Y9862',
                        'user2': 's9M2bNeRTsaun7OmlmVDRJxeeDa2',
                        'user3': '10vjM8PJUNVnBbYBwOhbQfEYwMe2',
                        'user4': 'ovyk5WB4AEbNXjDH4yIOyg6Y9862',
                        'user5': 'qulFMEO4lAVfOQ8aVbLU9k8hJqI2',
                        'user6': 's9M2bNeRTsaun7OmlmVDRJxeeDa2'
                    };

                    const uid = screennameToUid[screenname.toLowerCase()];
                    if (uid && snapshot.val()[uid]) {
                        const userData = snapshot.val()[uid];
                        userToAdd = {
                            uid: uid,
                            screenname: screenname,
                            lastSeen: userData.lastSeen,
                            online: userData.online
                        };
                        console.log('Found user via screenname mapping:', userToAdd);
                    } else {
                        console.log('No user found with that screenname');
                    }
                } else {
                    console.log('No status data exists in Firebase');
                }
            } catch (error) {
                console.error('Error in direct Firebase lookup:', error);
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

    // Fetch all users and buddy lists
    useEffect(() => {
        if (!buddyListVisible || !auth.currentUser) return;

        const statusRef = ref(database, 'status');
        const buddyListRef = ref(database, `buddyLists/${auth.currentUser.uid}`);

        const unsubscribeStatus = onValue(statusRef, (snapshot) => {
            const users = [];
            const currentUser = auth.currentUser;

            if (snapshot.exists()) {
                console.log('Status snapshot received:', snapshot.val());
                snapshot.forEach((childSnapshot) => {
                    const userData = childSnapshot.val();
                    console.log(`User ${childSnapshot.key}:`, userData);

                    // Skip the current user
                    if (currentUser && childSnapshot.key === currentUser.uid) {
                        console.log('Skipping current user:', childSnapshot.key);
                        return;
                    }

                    // Only include users who have been online recently (within last 24 hours)
                    // and have a lastSeen timestamp
                    if (userData.lastSeen) {
                        const oneDayAgo = Date.now() - (24 * 60 * 60 * 1000);
                        if (userData.lastSeen > oneDayAgo) {
                            const user = {
                                uid: childSnapshot.key,
                                screenname: userData.screenname || `user_${childSnapshot.key.slice(0, 8)}`, // Fallback screenname
                                lastSeen: userData.lastSeen,
                                online: userData.online
                            };
                            console.log('Adding user to allUsers:', user);
                            users.push(user);
                        } else {
                            console.log('Skipping old user:', childSnapshot.key, 'lastSeen:', userData.lastSeen);
                        }
                    } else {
                        console.log('Skipping user without lastSeen:', childSnapshot.key);
                    }
                });
            }

            console.log('Setting allUsers:', users);
            setAllUsers(users);
        });

        const unsubscribeBuddyList = onValue(buddyListRef, (snapshot) => {
            if (snapshot.exists()) {
                setMyBuddies(snapshot.val());
            } else {
                setMyBuddies({});
            }
            setLoading(false);
        }, (error) => {
            console.error('Error fetching buddy list:', error);
            setLoading(false);
        });

        return () => {
            off(statusRef, 'value', unsubscribeStatus);
            off(buddyListRef, 'value', unsubscribeBuddyList);
        };
    }, [buddyListVisible, auth.currentUser]);

    // Handle visibility and positioning
    useEffect(() => {
        if (winRef.current) {
            if (buddyListVisible) {
                // Position the window in the upper right area
                const rect = winRef.current.getBoundingClientRect();
                const vw = window.innerWidth;
                const vh = window.innerHeight;
                const left = Math.max(0, vw - rect.width - (vw * 0.1)); // 10% from right edge
                const top = Math.max(0, vh * 0.1); // 10% from top edge
                winRef.current.style.left = `${left}px`;
                winRef.current.style.top = `${top}px`;
                winRef.current.style.visibility = "visible";
            } else {
                winRef.current.style.visibility = "hidden";
            }
        }
    }, [buddyListVisible]);

    // Helper function to get buddy list with online status
    const getBuddyListWithStatus = (category) => {
        if (!myBuddies[category]) return [];

        return Object.entries(myBuddies[category]).map(([buddyId, buddyData]) => {
            const userData = allUsers.find(user => user.uid === buddyData.uid);
            return {
                ...buddyData,
                buddyId,
                online: userData ? userData.online : false,
                lastSeen: userData ? userData.lastSeen : null
            };
        }).sort((a, b) => a.screenname.localeCompare(b.screenname));
    };

    // Helper function to get online buddies only
    const getOnlineBuddies = (category) => {
        return getBuddyListWithStatus(category).filter(buddy => buddy.online);
    };

    // Helper function to get offline buddies only
    const getOfflineBuddies = (category) => {
        return getBuddyListWithStatus(category).filter(buddy => !buddy.online);
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

    console.log('BuddyListWindow render - buddyListVisible:', buddyListVisible);
    if (!buddyListVisible) return null;

    return (
        <div
            ref={winRef}
            id="buddylist-window"
            className={`window w-[250px] h-[600px] absolute z-50 ${isWindowActive('buddylist') ? '' : 'window-inactive'}`}
            style={{ visibility: "hidden" }}
            onMouseDown={() => focusWindow('buddylist')}
        >
            <div className="title-bar buddylist-header" onMouseDown={handleMouseDown}>
                <div className="title-bar-text">
                    <img src="/ui/ico-buddylist.png" alt="" className="h-[16px] inline-block" /> {currentUserScreenname}'s Buddy List
                </div>
                <div className="title-bar-controls">
                    <button aria-label="Minimize" onClick={() => setBuddyListVisible(false)} />
                    <button aria-label="Maximize" />
                    <button aria-label="Close" />
                </div>
            </div>

            <div className="window-body p-1" onClick={handleContainerClick}>
                {/* Menu Toolbar */}
                <div className="border-b border-[#808080] px-2 py-1 flex items-center gap-4 menu-toolbar">
                    <span>My AIM</span>
                    <span>People</span>
                    <span>Help</span>
                </div>

                <div className="">
                    <img src="/assets/images/aim.png" alt="AIM" className="w-full h-full" />
                </div>

                {loading ? (
                    <div className="text-sm text-gray-600 py-2">Loading buddies...</div>
                ) : (
                    <>
                        {/* Buddies Section */}

                        <div className="bg-white p-1 min-h-[350px] xp-border">

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
                                        >
                                            <div
                                                className="flex items-center flex-1"
                                                onDoubleClick={(e) => handleUserDoubleClick(buddy, e)}
                                            >
                                                <span className="mr-1 text-black inline-block w-4 text-center">
                                                    {/* Empty space to align with arrow */}
                                                </span>
                                                <span className={`text-sm font-medium ${buddy.online ? 'text-[#1d1272]' : 'text-[#a29e8f] italic'} ${selectedUser === buddy.buddyId ? 'selected-user' : ''}`}>
                                                    {buddy.screenname}
                                                </span>
                                            </div>
                                            <button
                                                onClick={() => handleRemoveBuddy(buddy.buddyId, 'buddies')}
                                                className="text-red-500 hover:text-red-700 text-xs px-1"
                                            >
                                                ×
                                            </button>
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
                                        >
                                            <div
                                                className="flex items-center flex-1"
                                                onDoubleClick={(e) => handleUserDoubleClick(buddy, e)}
                                            >
                                                <span className="mr-1 text-black inline-block w-4 text-center">
                                                    {/* Empty space to align with arrow */}
                                                </span>
                                                <span className={`text-sm font-medium ${buddy.online ? 'text-[#1d1272]' : 'text-[#a29e8f] italic'} ${selectedUser === buddy.buddyId ? 'selected-user' : ''}`}>
                                                    {buddy.screenname}
                                                </span>
                                            </div>
                                            <button
                                                onClick={() => handleRemoveBuddy(buddy.buddyId, 'family')}
                                                className="text-red-500 hover:text-red-700 text-xs px-1"
                                            >
                                                ×
                                            </button>
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
                                        >
                                            <div
                                                className="flex items-center flex-1"
                                                onDoubleClick={(e) => handleUserDoubleClick(buddy, e)}
                                            >
                                                <span className="mr-1 text-black inline-block w-4 text-center">
                                                    {/* Empty space to align with arrow */}
                                                </span>
                                                <span className={`text-sm font-medium ${buddy.online ? 'text-[#1d1272]' : 'text-[#a29e8f] italic'} ${selectedUser === buddy.buddyId ? 'selected-user' : ''}`}>
                                                    {buddy.screenname}
                                                </span>
                                            </div>
                                            <button
                                                onClick={() => handleRemoveBuddy(buddy.buddyId, 'coworkers')}
                                                className="text-red-500 hover:text-red-700 text-xs px-1"
                                            >
                                                ×
                                            </button>
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
                                const offlineBuddies = [...getOfflineBuddies('buddies'), ...getOfflineBuddies('family'), ...getOfflineBuddies('coworkers')];
                                return (
                                    <div className="space-y-0 mb-3">
                                        {offlineBuddies.length > 0 && offlineBuddies
                                            .sort((a, b) => a.screenname.localeCompare(b.screenname))
                                            .map((buddy) => (
                                                <div
                                                    key={buddy.buddyId}
                                                    className={`flex items-center cursor-pointer border border-transparent user-item`}
                                                    onClick={() => handleUserSelect(buddy)}
                                                    onDoubleClick={(e) => handleUserDoubleClick(buddy, e)}
                                                >
                                                    <span className="mr-1 text-black inline-block w-4 text-center">
                                                        {/* Empty space to align with arrow */}
                                                    </span>
                                                    <span className={`text-sm font-medium text-[#a29e8f] italic ${selectedUser === buddy.buddyId ? 'selected-user' : ''}`}>
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
                        className="w-full px-3 py-1 text-sm bg-[#d4d0c8] text-black hover:bg-[#c0c0c0] border border-[#808080] border-t-[#ffffff] border-l-[#ffffff]"
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
                                className="w-full px-3 py-1 text-sm bg-[#d4d0c8] text-black hover:bg-[#c0c0c0] border border-[#808080] border-t-[#ffffff] border-l-[#ffffff]"
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
    );
}