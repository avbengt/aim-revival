"use client";

import { useState, useEffect, useRef } from "react";
import { signInWithEmailAndPassword, createUserWithEmailAndPassword } from "firebase/auth";
import { doc, setDoc } from "firebase/firestore";
import { ref, set, onDisconnect, get } from "firebase/database";
import { auth, db, database } from "@/lib/firebase";
import { useWindowManager } from "@/context/WindowManagerContext";

export default function LoginWindow() {
    const { loginWindowVisible, setLoginWindowVisible, setBuddyListVisible } = useWindowManager();
    const winRef = useRef(null);

    // Handle visibility and ensure proper positioning
    useEffect(() => {
        if (winRef.current) {
            if (loginWindowVisible) {
                // Make sure the window is visible first
                winRef.current.style.visibility = "visible";

                // Check if we have a saved position
                const savedPosition = localStorage.getItem("login-window-position");
                if (savedPosition) {
                    try {
                        const { top, left } = JSON.parse(savedPosition);
                        if (typeof top === "number" && typeof left === "number") {
                            winRef.current.style.top = `${top}px`;
                            winRef.current.style.left = `${left}px`;
                        }
                    } catch (e) {
                        console.log("Error parsing saved position:", e);
                    }
                } else {
                    // Center the window if no saved position
                    const rect = winRef.current.getBoundingClientRect();
                    const vw = window.innerWidth;
                    const vh = window.innerHeight;
                    const left = Math.max(0, Math.floor((vw - rect.width) / 2));
                    const top = Math.max(0, Math.floor((vh - rect.height) / 2));
                    winRef.current.style.left = `${left}px`;
                    winRef.current.style.top = `${top}px`;
                }

                // Add manual drag functionality
                const header = winRef.current.querySelector(".title-bar");
                if (header) {
                    let startX = 0, startY = 0, startLeft = 0, startTop = 0, dragging = false;

                    const handleMouseDown = (e) => {
                        if (e.button !== 0) return;
                        if (e.target.closest?.(".title-bar-controls") || e.target.closest?.("button")) return;

                        dragging = true;
                        startLeft = parseInt(winRef.current.style.left || "0", 10);
                        startTop = parseInt(winRef.current.style.top || "0", 10);
                        startX = e.clientX;
                        startY = e.clientY;
                    };

                    const handleMouseMove = (e) => {
                        if (!dragging) return;
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
                        const clampedLeft = Math.max(0, Math.min(newLeft, window.innerWidth - windowWidth));
                        const clampedTop = Math.max(0, Math.min(newTop, window.innerHeight - windowHeight));

                        winRef.current.style.left = `${clampedLeft}px`;
                        winRef.current.style.top = `${clampedTop}px`;
                    };

                    const handleMouseUp = () => {
                        if (!dragging) return;
                        dragging = false;

                        // Save position
                        localStorage.setItem("login-window-position", JSON.stringify({
                            top: parseInt(winRef.current.style.top || "0", 10),
                            left: parseInt(winRef.current.style.left || "0", 10),
                        }));
                    };

                    header.addEventListener("mousedown", handleMouseDown);
                    window.addEventListener("mousemove", handleMouseMove);
                    window.addEventListener("mouseup", handleMouseUp);

                    // Cleanup function
                    return () => {
                        header.removeEventListener("mousedown", handleMouseDown);
                        window.removeEventListener("mousemove", handleMouseMove);
                        window.removeEventListener("mouseup", handleMouseUp);
                    };
                }
            } else {
                winRef.current.style.visibility = "hidden";
            }
        }
    }, [loginWindowVisible]);

    const [screenname, setScreenname] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");

    // Set user online status in Realtime Database
    const setOnlineStatus = async (uid, screenname) => {
        console.log('setOnlineStatus called with:', { uid, screenname });
        try {
            const userStatusRef = ref(database, `status/${uid}`);
            const userInfoRef = ref(database, `users/${uid}`);

            // Check if user already has a screenname stored
            const existingStatusSnapshot = await get(userStatusRef);
            const existingUserSnapshot = await get(userInfoRef);

            let finalScreenname = screenname;

            // If user already has a screenname stored, preserve it (don't overwrite)
            if (existingStatusSnapshot.exists() && existingStatusSnapshot.val().screenname) {
                const existingScreenname = existingStatusSnapshot.val().screenname;
                // Only update if the existing screenname is lowercase (to fix old data)
                if (existingScreenname === existingScreenname.toLowerCase()) {
                    console.log('Updating lowercase screenname to proper case:', existingScreenname, '->', screenname);
                    finalScreenname = screenname;
                } else {
                    console.log('Preserving existing screenname:', existingScreenname);
                    finalScreenname = existingScreenname;
                }
            } else {
                console.log('No existing screenname found, using new one:', screenname);
            }

            console.log('Setting user as online...');
            // Set user as online
            await set(userStatusRef, {
                online: true,
                lastSeen: Date.now(),
                screenname: finalScreenname
            });

            console.log('Setting user info...');
            // Set user info
            await set(userInfoRef, {
                screenname: finalScreenname,
                uid: uid
            });

            console.log('Setting up disconnect handler...');
            // Set up disconnect handler to mark user as offline when they disconnect
            onDisconnect(userStatusRef).update({
                online: false,
                lastSeen: Date.now(),
                screenname: finalScreenname
            });

            console.log('setOnlineStatus completed successfully');
        } catch (error) {
            console.log('setOnlineStatus error:', error);
            // Don't throw error - just log it so login can still work
        }
    };

    const handleLogin = async (e) => {
        e.preventDefault();
        setError("");

        console.log('Login attempt started');

        if (!screenname.trim() || !password.trim()) {
            setError("Please enter both a screen name and password.");
            return;
        }
        if (password.length < 6) {
            setError("Password must be at least 6 characters.");
            return;
        }

        const email = `${screenname}@aim-revival.com`;
        console.log('Attempting login with email:', email);

        try {
            console.log('Trying to sign in existing user...');
            const userCredential = await signInWithEmailAndPassword(auth, email, password);
            console.log('Sign in successful:', userCredential.user.uid);
            // Set online status for existing user with proper case screenname
            await setOnlineStatus(userCredential.user.uid, screenname);
        } catch (error) {
            console.log('Sign in error:', error.code, error.message);
            try {
                console.log('Trying to create new user...');
                const cred = await createUserWithEmailAndPassword(auth, email, password);
                console.log('Create user successful:', cred.user.uid);
                await setDoc(doc(db, "users", cred.user.uid), { screenname });
                // Set online status for new user
                await setOnlineStatus(cred.user.uid, screenname);
            } catch (err) {
                console.log('Create account error:', err.code, err.message);
                const msg = String(err?.message || "")
                    .includes("auth/email-already-in-use")
                    ? "Invalid screen name or password."
                    : "Login/signup failed. Try a different screen name.";
                setError(msg);
                return;
            }
        }

        console.log('Login process completed, hiding login window');
        setLoginWindowVisible(false);
        setBuddyListVisible(true);
    };

    console.log('LoginWindow render - loginWindowVisible:', loginWindowVisible);
    if (!loginWindowVisible) {
        console.log('LoginWindow returning null due to !loginWindowVisible');
        return null;
    }

    return (
        <div
            ref={winRef}
            id="login-window"
            className="window login-window w-[250px] h-[450px] absolute z-50"
            // start hidden to avoid top-left flash; hook will set top/left then we reveal in useEffect
            style={{ visibility: "hidden", right: "auto", bottom: "auto" }}
        >
            <div className="title-bar login-header">
                <div className="title-bar-text">
                    <img src="/login/running-man.svg" alt="" className="h-[16px] inline-block mb-1" /> Sign On
                </div>
                <div className="title-bar-controls">
                    <button
                        aria-label="Minimize"
                        onClick={() => setLoginWindowVisible(false)}
                    />
                    <button
                        aria-label="Maximize"
                        disabled
                        className="opacity-50"
                    />
                    <button aria-label="Close" />
                </div>
            </div>

            <div className="window-body px-1 pt-2">
                <div className="bg-[#00008f] py-4 px-7 relative">
                    <img src="/login/logo.svg" alt="AOL Instant Messenger logo" className="w-[90%] h-auto" />
                    <img src="/login/wordmark.svg" alt="AIM wordmark" className="w-full h-auto mt-4" />
                    <p className="text-[#fcce62] text-md italic font-bold absolute bottom-8 right-7">Revival</p>
                </div>

                <hr className="mt-2 border-1 border-t-[#9b9287] border-b-[#f9f7fe] border-r-0 border-l-0" />

                <form onSubmit={handleLogin} className="px-3 py-2">
                    <div>
                        <label htmlFor="screenName" className="block">
                            <img src="/login/sn-label.png" alt="Screen Name" />
                        </label>
                        <input
                            id="screenName"
                            name="screenname"
                            value={screenname}
                            onChange={(e) => setScreenname(e.target.value)}
                            className="w-full px-3 bg-white text-black text-sm focus:outline-none border-2 border-l-indigo-500 border-t-indigo-500"
                            type="text"
                        />
                        <p className="underline text-[#1d1272] cursor-pointer">Get a Screen Name</p>
                    </div>

                    <div className="field-row-stacked h-[47px]">
                        <label htmlFor="passWord" className="block text-black text-sm font-bold mt-2">
                            Password
                        </label>
                        <input
                            id="passWord"
                            name="password"
                            type="password"
                            placeholder="Password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="w-full px-3 my-0! bg-white text-black text-sm focus:outline-none"
                        />
                    </div>

                    <p className="underline text-[#1d1272] mt-0 cursor-pointer">Forgot Password?</p>
                    <div className="flex items-center justify-between mt-2">
                        <input type="checkbox" id="savePass" />
                        <label htmlFor="savePass">Save password</label>
                        <input type="checkbox" id="autoLogin" />
                        <label htmlFor="autoLogin">Auto-login</label>
                    </div>
                    <div className="flex items-center justify-between mt-2">
                        <div className="flex items-center gap-2">
                            <img
                                src="/login/help1.png"
                                alt="Help"
                                className="mt-2 cursor-pointer"
                                onMouseEnter={(e) => e.target.src = "/login/help2.png"}
                                onMouseLeave={(e) => e.target.src = "/login/help1.png"}
                                onMouseDown={(e) => e.target.src = "/login/help3.png"}
                                onMouseUp={(e) => e.target.src = "/login/help2.png"}
                            />

                            <img
                                src="/login/setup1.png"
                                alt="Setup"
                                className="mt-2 cursor-pointer"
                                onMouseEnter={(e) => e.target.src = "/login/setup2.png"}
                                onMouseLeave={(e) => e.target.src = "/login/setup1.png"}
                                onMouseDown={(e) => e.target.src = "/login/setup3.png"}
                                onMouseUp={(e) => e.target.src = "/login/setup2.png"}
                            />
                        </div>

                        <img
                            src="/login/signon1.png"
                            alt="Sign On"
                            className="mt-2 cursor-pointer"
                            onClick={() => document.querySelector('form').requestSubmit()}
                            onMouseEnter={(e) => e.target.src = "/login/signon2.png"}
                            onMouseLeave={(e) => e.target.src = "/login/signon1.png"}
                            onMouseDown={(e) => e.target.src = "/login/signon3.png"}
                            onMouseUp={(e) => e.target.src = "/login/signon2.png"}
                        />
                    </div>
                </form>

                {error && <p className="text-red-600 text-sm mt-3 text-center">{error}</p>}
            </div>
        </div>
    );
}