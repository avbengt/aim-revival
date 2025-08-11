"use client";

import { useEffect, useRef, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { useRouter } from "next/navigation";
import { auth, db } from "@/lib/firebase";
import {
    collection,
    doc,
    getDoc,
    onSnapshot,
    query,
    updateDoc,
    where,
    orderBy,
} from "firebase/firestore";
import { onDisconnect, ref, set as rtdbSet } from "firebase/database";
import { getDatabase } from "firebase/database";

type Buddy = {
    uid: string;
    screenname: string;
    online: boolean;
};

export default function BuddyList() {
    const router = useRouter();
    const [currentUserId, setCurrentUserId] = useState<string | null>(null);
    const [buddies, setBuddies] = useState<{ online: Buddy[]; offline: Buddy[] }>({
        online: [],
        offline: [],
    });

    const openedChats = useRef<Map<string, Window | null>>(new Map());
    const hasInitializedListener = useRef(false);

    useEffect(() => {
        let unsubscribeUsers = () => { };
        let unsubscribeMessages = () => { };

        const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
            if (!user) {
                router.push("/login");
                return;
            }

            setCurrentUserId(user.uid);

            // Realtime Database presence tracking
            const rtdb = getDatabase();
            const statusRef = ref(rtdb, `/status/${user.uid}`);
            rtdbSet(statusRef, true);
            onDisconnect(statusRef).remove();

            // Mark user as online
            await updateDoc(doc(db, "users", user.uid), { online: true });

            // Buddy list snapshot
            const usersRef = collection(db, "users");
            unsubscribeUsers = onSnapshot(usersRef, (snapshot) => {
                const allUsers: Buddy[] = snapshot.docs.map((doc) => {
                    const data = doc.data();
                    return {
                        uid: doc.id,
                        screenname: data.screenname || "",
                        online: data.online || false,
                    };
                });

                const online = allUsers.filter(
                    (u) => u.uid !== user.uid && u.online && u.screenname
                );
                const offline = allUsers.filter(
                    (u) => u.uid !== user.uid && !u.online && u.screenname
                );

                setBuddies({ online, offline });
            });

            if (!hasInitializedListener.current) {
                hasInitializedListener.current = true;

                const messagesRef = collection(db, "messages");
                const q = query(
                    messagesRef,
                    where("to", "==", user.uid),
                    orderBy("timestamp", "desc")
                );

                unsubscribeMessages = onSnapshot(q, (snapshot) => {
                    const now = Date.now();
                    snapshot.docChanges().forEach((change) => {
                        if (change.type === "added") {
                            const msg = change.doc.data();

                            // Only react to messages from the last 10 seconds
                            if (!msg.timestamp?.toDate) return;
                            const messageTime = msg.timestamp.toDate().getTime();
                            if (now - messageTime > 10000) return; // skip old messages

                            const existingWindow = openedChats.current.get(msg.from);
                            if (!existingWindow || existingWindow.closed) {
                                getDoc(doc(db, "users", msg.from)).then((docSnap) => {
                                    const screenname = docSnap.exists()
                                        ? docSnap.data().screenname
                                        : null;

                                    const url = screenname
                                        ? `/chat/${msg.from}?screenname=${encodeURIComponent(screenname)}`
                                        : `/chat/${msg.from}`;

                                    const chatWindow = window.open(
                                        url,
                                        `_blank`,
                                        "width=400,height=500,resizable=yes,scrollbars=yes"
                                    );

                                    if (chatWindow) {
                                        chatWindow.focus();
                                        openedChats.current.set(msg.from, chatWindow);
                                    }
                                });
                            }
                        }
                    });
                });
            }
        });

        return () => {
            unsubscribeAuth();
            unsubscribeUsers();
            unsubscribeMessages();
        };
    }, [router]);

    const handleChat = (buddy: Buddy) => {
        const existingWindow = openedChats.current.get(buddy.uid);
        if (!existingWindow || existingWindow.closed) {
            const chatWindow = window.open(
                `/chat/${buddy.uid}?screenname=${encodeURIComponent(buddy.screenname)}`,
                `_blank`,
                "width=600,height=450,resizable=yes,scrollbars=yes"
            );
            if (chatWindow) {
                chatWindow.focus();
                openedChats.current.set(buddy.uid, chatWindow);
            }
        } else {
            existingWindow.focus(); // bring it to front if already open
        }
    };

    if (!currentUserId) {
        return <p className="text-center mt-10">Loading buddy list...</p>;
    }

    return (
        <div className="p-4">
            <h1 className="text-xl font-bold mb-4">Buddy List</h1>
            <div>
                <h2 className="text-lg font-semibold mb-2">Buddies</h2>
                <ul className="mb-4">
                    {buddies.online.map((buddy) => (
                        <li
                            key={buddy.uid}
                            onClick={() => handleChat(buddy)}
                            className="cursor-pointer hover:underline"
                        >
                            🟢 {buddy.screenname}
                        </li>
                    ))}
                </ul>

                <h2 className="text-lg font-semibold mb-2">Offline</h2>
                <ul>
                    {buddies.offline.map((buddy) => (
                        <li
                            key={buddy.uid}
                            onClick={() => handleChat(buddy)}
                            className="cursor-pointer text-gray-400 hover:underline"
                        >
                            ⚪ {buddy.screenname}
                        </li>
                    ))}
                </ul>
            </div>
        </div>
    );
}