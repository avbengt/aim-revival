"use client";
import { useEffect } from "react";
import { ref, set, update, onDisconnect, get } from "firebase/database";
import { signOut } from "firebase/auth";
import { database, auth } from "@/lib/firebase";

export default function OfflineHandler() {
    useEffect(() => {
        let disconnectRef = null;

        const setupOfflineHandling = async () => {
            if (auth.currentUser) {
                const userStatusRef = ref(database, `status/${auth.currentUser.uid}`);

                // Get existing screenname to preserve it (check both status and users nodes)
                let existingScreenname = null;
                try {
                    const statusSnapshot = await get(userStatusRef);
                    if (statusSnapshot.exists()) {
                        existingScreenname = statusSnapshot.val().screenname;
                    }
                    // If not in status, check users node
                    if (!existingScreenname) {
                        const userInfoRef = ref(database, `users/${auth.currentUser.uid}`);
                        const userSnapshot = await get(userInfoRef);
                        if (userSnapshot.exists()) {
                            existingScreenname = userSnapshot.val().screenname;
                        }
                    }
                } catch (error) {
                    console.log('Could not get existing screenname:', error);
                }

                // Set up disconnect handler - preserve screenname if it exists
                disconnectRef = onDisconnect(userStatusRef);
                const disconnectData = {
                    online: false,
                    lastSeen: Date.now()
                };
                if (existingScreenname) {
                    disconnectData.screenname = existingScreenname;
                }
                disconnectRef.update(disconnectData);
                console.log('Set up disconnect handler for user:', auth.currentUser.uid);
            }
        };

        const handleBeforeUnload = () => {
            if (auth.currentUser) {
                console.log('User is leaving page, setting offline and signing out');

                // Use Firebase's built-in disconnect handler for offline status
                // This is more reliable than trying to do it manually

                // Sign out immediately - this will trigger the auth state change
                // which will clean up the disconnect handler and set offline status
                signOut(auth).catch(error => {
                    console.log('Error signing out on beforeunload:', error);
                });

                console.log('Signed out user on beforeunload');
            }
        };

        // Do not change online/offline status on tab switch (visibility change).
        // Firebase onDisconnect will set offline when the tab is closed or the user navigates away.
        // This prevents users from appearing "signed off" when they merely switch to another tab.

        let statusInterval = null;

        // Set up offline handling when user is authenticated
        const unsubscribe = auth.onAuthStateChanged((user) => {
            if (user) {
                setupOfflineHandling();

                // Update lastSeen every 30 seconds to keep status fresh
                statusInterval = setInterval(async () => {
                    if (auth.currentUser) {
                        const userStatusRef = ref(database, `status/${auth.currentUser.uid}`);
                        try {
                            // Get existing screenname to preserve it (check both status and users nodes)
                            let existingScreenname = null;
                            try {
                                const statusSnapshot = await get(userStatusRef);
                                if (statusSnapshot.exists()) {
                                    existingScreenname = statusSnapshot.val().screenname;
                                }
                                // If not in status, check users node
                                if (!existingScreenname && auth.currentUser) {
                                    const userInfoRef = ref(database, `users/${auth.currentUser.uid}`);
                                    const userSnapshot = await get(userInfoRef);
                                    if (userSnapshot.exists()) {
                                        existingScreenname = userSnapshot.val().screenname;
                                    }
                                }
                            } catch (e) {
                                console.log('Could not get existing screenname:', e);
                            }

                            // Use update to preserve screenname field
                            const updateData = {
                                online: true,
                                lastSeen: Date.now()
                            };
                            if (existingScreenname) {
                                updateData.screenname = existingScreenname;
                            }
                            await update(userStatusRef, updateData);
                        } catch (error) {
                            console.log('Error updating lastSeen:', error);
                        }
                    }
                }, 30000);
            } else {
                // User signed out - set them offline in Firebase
                if (disconnectRef) {
                    // Cancel the disconnect handler since user is signing out
                    disconnectRef.cancel();
                    disconnectRef = null;
                    console.log('Cleaned up disconnect handler');
                }

                // Clear status update interval
                if (statusInterval) {
                    clearInterval(statusInterval);
                    statusInterval = null;
                }

                console.log('User signed out, they will show as offline to buddies');
            }
        });

        window.addEventListener('beforeunload', handleBeforeUnload);
        window.addEventListener('pagehide', handleBeforeUnload);

        return () => {
            window.removeEventListener('beforeunload', handleBeforeUnload);
            window.removeEventListener('pagehide', handleBeforeUnload);
            unsubscribe();

            // Clean up disconnect handler
            if (disconnectRef) {
                disconnectRef.cancel();
            }

            // Clean up status interval
            if (statusInterval) {
                clearInterval(statusInterval);
            }
        };
    }, []);

    return null; // This component doesn't render anything
}
