"use client";
import { useEffect } from "react";
import { ref, set, onDisconnect } from "firebase/database";
import { signOut } from "firebase/auth";
import { database, auth } from "@/lib/firebase";

export default function OfflineHandler() {
    useEffect(() => {
        let disconnectRef = null;

        const setupOfflineHandling = () => {
            if (auth.currentUser) {
                const userStatusRef = ref(database, `status/${auth.currentUser.uid}`);

                // Set up disconnect handler
                disconnectRef = onDisconnect(userStatusRef);
                disconnectRef.update({
                    online: false,
                    lastSeen: Date.now()
                });
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

        const handleVisibilityChange = () => {
            // Only handle visibility change, don't sign out on tab switch
            if (document.visibilityState === 'hidden' && auth.currentUser) {
                const userStatusRef = ref(database, `status/${auth.currentUser.uid}`);
                try {
                    // Just set offline status, don't sign out on tab switch
                    set(userStatusRef, {
                        online: false,
                        lastSeen: Date.now()
                    }).catch(error => {
                        console.log('Error setting offline status on visibility change:', error);
                    });
                    console.log('Set offline status on visibility change for user:', auth.currentUser.uid);
                } catch (error) {
                    console.log('Error in visibility change handler:', error);
                }
            } else if (document.visibilityState === 'visible' && auth.currentUser) {
                // Set back to online when user returns to tab
                const userStatusRef = ref(database, `status/${auth.currentUser.uid}`);
                try {
                    set(userStatusRef, {
                        online: true,
                        lastSeen: Date.now()
                    }).catch(error => {
                        console.log('Error setting online status on visibility change:', error);
                    });
                    console.log('Set online status on visibility change for user:', auth.currentUser.uid);
                } catch (error) {
                    console.log('Error setting online status:', error);
                }
            }
        };

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
                            await set(userStatusRef, {
                                online: true,
                                lastSeen: Date.now()
                            });
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
        document.addEventListener('visibilitychange', handleVisibilityChange);

        return () => {
            window.removeEventListener('beforeunload', handleBeforeUnload);
            window.removeEventListener('pagehide', handleBeforeUnload);
            document.removeEventListener('visibilitychange', handleVisibilityChange);
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
