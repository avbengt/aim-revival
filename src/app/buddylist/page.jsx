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
import { onDisconnect, ref, set as rtdbSet, getDatabase } from "firebase/database";

export default function BuddyList() {
    const router = useRouter();
    const [currentUserId, setCurrentUserId] = useState(null);
    const [buddies, setBuddies] = useState({ online: [], offline: [] });

    // Track opened chat popups so we don't spam new windows
    const openedChats = useRef(new Map());
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

            // Mark user as online in Firestore
            await updateDoc(doc(db, "users", user.uid), { online: true });

            // Listen to all users and split online/offline
            const usersRef = collection(db, "users");
            unsubscribeUsers = onSnapshot(usersRef, (snapshot) => {
                const allUsers = snapshot.docs.map((d) => {
                    const data = d.data() || {};
                    return {
                        uid: d.id,
                        screenname: data.screenname || "",
                        online: !!data.online,
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

            // One-time incoming message listener (to pop a chat window)
            if (!hasInitializedListener.current) {
                hasInitializedListener.current = true;

                const messagesRef = collection(db, "messages");
                const qy = query(
                    messagesRef,
                    where("to", "==", user.uid),
                    orderBy("timestamp", "desc")
                );

                unsubscribeMessages = onSnapshot(qy, (snapshot) => {
                    const now = Date.now();

                    snapshot.docChanges().forEach((change) => {
                        if (change.type !== "added") return;

                        const msg = change.doc.data();

                        // Ignore older messages so we only pop on fresh ones
                        if (!msg.timestamp || !msg.timestamp.toDate) return;
                        const messageTime = msg.timestamp.toDate().getTime();
                        if (now - messageTime > 10000) return;

                        const existingWindow = openedChats.current.get(msg.from);
                        if (!existingWindow || existingWindow.closed) {
                            getDoc(doc(db, "users", msg.from)).then((docSnap) => {
                                const screenname = docSnap.exists() ? docSnap.data().screenname : null;

                                const url = screenname
                                    ? `/chat/${msg.from}?screenname=${encodeURIComponent(screenname)}`
                                    : `/chat/${msg.from}`;

                                const chatWindow = window.open(
                                    url,
                                    "_blank",
                                    "width=400,height=500,resizable=yes,scrollbars=yes"
                                );

                                if (chatWindow) {
                                    chatWindow.focus();
                                    openedChats.current.set(msg.from, chatWindow);
                                }
                            });
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

    const handleChat = (buddy) => {
        const existingWindow = openedChats.current.get(buddy.uid);
        if (!existingWindow || existingWindow.closed) {
            const chatWindow = window.open(
                `/chat/${buddy.uid}?screenname=${encodeURIComponent(buddy.screenname)}`,
                "_blank",
                "width=600,height=450,resizable=yes,scrollbars=yes"
            );
            if (chatWindow) {
                chatWindow.focus();
                openedChats.current.set(buddy.uid, chatWindow);
            }
        } else {
            existingWindow.focus();
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