"use client";
import { useEffect } from "react";
import { ref, set, onDisconnect } from "firebase/database";
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

        const handleBeforeUnload = async () => {
            if (auth.currentUser) {
                const userStatusRef = ref(database, `status/${auth.currentUser.uid}`);
                try {
                    await set(userStatusRef, {
                        online: false,
                        lastSeen: Date.now()
                    });
                    console.log('Set offline status on beforeunload for user:', auth.currentUser.uid);
                } catch (error) {
                    console.log('Error setting offline status on beforeunload:', error);
                }
            }
        };

        const handleVisibilityChange = async () => {
            if (document.visibilityState === 'hidden' && auth.currentUser) {
                const userStatusRef = ref(database, `status/${auth.currentUser.uid}`);
                try {
                    await set(userStatusRef, {
                        online: false,
                        lastSeen: Date.now()
                    });
                    console.log('Set offline status on visibility change for user:', auth.currentUser.uid);
                } catch (error) {
                    console.log('Error setting offline status on visibility change:', error);
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
                // Clean up disconnect handler when user signs out
                if (disconnectRef) {
                    disconnectRef.cancel();
                    disconnectRef = null;
                    console.log('Cleaned up disconnect handler');
                }

                // Clear status update interval
                if (statusInterval) {
                    clearInterval(statusInterval);
                    statusInterval = null;
                }
            }
        });

        window.addEventListener('beforeunload', handleBeforeUnload);
        document.addEventListener('visibilitychange', handleVisibilityChange);

        return () => {
            window.removeEventListener('beforeunload', handleBeforeUnload);
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
