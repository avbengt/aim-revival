"use client";

import { useState, useEffect, useRef } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { db, auth } from "@/lib/firebase";
import {
    addDoc,
    collection,
    serverTimestamp,
    onSnapshot,
    query,
    orderBy,
    where,
    Timestamp,
} from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";

export const metadata = {
    title: "Instant Message",
};
export default function ChatWindow() {
    const params = useParams();
    const chatPartnerId = params.uid;
    const searchParams = useSearchParams();
    const screenname = searchParams.get("screenname") || "Unknown User";
    const [currentUserId, setCurrentUserId] = useState(null);
    const [message, setMessage] = useState("");
    const [messages, setMessages] = useState([]);
    const [sessionStart] = useState(() => new Date());
    const messagesEndRef = useRef(null);
    const [myScreenname, setMyScreenname] = useState(null);
    const [theirScreenname, setTheirScreenname] = useState(null);


    // Get current user ID
    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (user) => {
            if (user) setCurrentUserId(user.uid);
        });
        return () => unsubscribe();
    }, []);

    // Load messages in real-time
    useEffect(() => {
        if (!currentUserId || !chatPartnerId) return;

        const q = query(
            collection(db, "messages"),
            where("from", "in", [currentUserId, chatPartnerId]),
            where("to", "in", [currentUserId, chatPartnerId]),
            orderBy("timestamp")
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const msgs = snapshot.docs
                .map((doc) => {
                    const data = doc.data();
                    return {
                        id: doc.id,
                        ...data,
                    };
                })
                .filter((msg) => msg.timestamp?.toDate().getTime() >= sessionStart.getTime() - 5000); // buffer 5 seconds so first received message displays

            setMessages(msgs);
        });

        return () => unsubscribe();
    }, [currentUserId, chatPartnerId, sessionStart]);

    useEffect(() => {
        if (messagesEndRef.current) {
            messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
        }
    }, [messages]);

    useEffect(() => {
        const fetchScreennames = async () => {
            if (!currentUserId || !chatPartnerId) return;

            try {
                const mySnap = await getDoc(doc(db, "users", currentUserId));
                const theirSnap = await getDoc(doc(db, "users", chatPartnerId));

                setMyScreenname(mySnap.exists() ? mySnap.data().screenname : "You");
                setTheirScreenname(theirSnap.exists() ? theirSnap.data().screenname : "Unknown");
            } catch (err) {
                console.error("Error fetching screen names:", err);
            }
        };

        fetchScreennames();
    }, [currentUserId, chatPartnerId]);

    const sendMessage = async () => {
        if (!message.trim() || !currentUserId) return;

        try {
            await addDoc(collection(db, "messages"), {
                from: currentUserId,
                to: chatPartnerId,
                text: message.trim(),
                timestamp: serverTimestamp(),
            });
            setMessage("");
        } catch (error) {
            console.error("Error sending message:", error);
        }
    };

    return (
        <div className="p-4">
            <h1 className="text-xl font-bold mb-4">Chat with {screenname || "Unknown User"}</h1>

            <div className="border p-2 h-64 overflow-y-auto mb-4 bg-white" style={{ fontFamily: "Times New Roman, serif" }}>
                {messages.map((msg) => (
                    <div
                        key={msg.id}
                        className="text-left whitespace-pre-wrap break-words"
                    >
                        <span
                            className="font-bold"
                            style={{ color: msg.from === currentUserId ? "red" : "blue" }}
                        >
                            {msg.from === currentUserId ? myScreenname : theirScreenname}
                        </span>
                        {": "}
                        <span>{msg.text}</span>
                    </div>
                ))}

                <div ref={messagesEndRef} />
            </div>
            <div className="flex items-center space-x-2">
                <input
                    type="text"
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && sendMessage()}
                    placeholder="Type your message..."
                    className="flex-1 border p-2"
                />
                <button
                    onClick={sendMessage}
                    className="bg-blue-500 text-white px-4 py-2 rounded"
                >
                    Send
                </button>
            </div>
        </div>
    );
}