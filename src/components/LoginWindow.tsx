"use client";

import { useState, useEffect, useRef } from "react";
import { signInWithEmailAndPassword, createUserWithEmailAndPassword } from "firebase/auth";
import { doc, setDoc } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { useWindowManager } from "@context/WindowManagerContext";

export default function LoginPage() {
    const [screenname, setScreenname] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const {
        loginWindowVisible,
        setLoginWindowVisible,
        setBuddyListVisible,
        setIsLoggedIn,
    } = useWindowManager();
    const loginRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const loginEl = document.getElementById("login-window");
        const header = document.getElementById("login-header");

        if (!loginEl || !header || !loginWindowVisible) return;

        let pos1 = 0,
            pos2 = 0,
            pos3 = 0,
            pos4 = 0;

        const dragMouseDown = (e: MouseEvent) => {
            e.preventDefault();
            pos3 = e.clientX;
            pos4 = e.clientY;
            document.addEventListener("mouseup", closeDragElement);
            document.addEventListener("mousemove", elementDrag);
        };

        const elementDrag = (e: MouseEvent) => {
            e.preventDefault();
            pos1 = pos3 - e.clientX;
            pos2 = pos4 - e.clientY;
            pos3 = e.clientX;
            pos4 = e.clientY;

            const newTop = loginEl.offsetTop - pos2;
            const newLeft = loginEl.offsetLeft - pos1;

            const winWidth = loginEl.offsetWidth;
            const winHeight = loginEl.offsetHeight;
            const screenWidth = window.innerWidth;
            const screenHeight = window.innerHeight;

            const clampedTop = Math.max(0, Math.min(newTop, screenHeight - winHeight));
            const clampedLeft = Math.max(0, Math.min(newLeft, screenWidth - winWidth));

            loginEl.style.top = `${clampedTop}px`;
            loginEl.style.left = `${clampedLeft}px`;
        };

        const closeDragElement = () => {
            document.removeEventListener("mouseup", closeDragElement);
            document.removeEventListener("mousemove", elementDrag);
        };

        header.addEventListener("mousedown", dragMouseDown);

        // 🧼 Clean up
        return () => {
            header.removeEventListener("mousedown", dragMouseDown);
        };
    }, [loginWindowVisible]); // <-- Add dependency here!

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");

        if (!screenname.trim() || !password.trim()) {
            setError("Please enter both a screen name and password.");
            return;
        }

        if (password.length < 6) {
            setError("Password must be at least 6 characters.");
            return;
        }

        const email = `${screenname}@aim-revival.com`;

        try {
            // Try to sign in
            await signInWithEmailAndPassword(auth, email, password);
        } catch (loginError: any) {
            console.warn("Login failed, attempting sign up...", loginError?.message);

            try {
                // If sign-in fails, try to sign up
                const userCredential = await createUserWithEmailAndPassword(auth, email, password);

                // Save screen name to Firestore
                await setDoc(doc(db, "users", userCredential.user.uid), {
                    screenname,
                });
            } catch (signupError: any) {
                console.error("Signup error:", signupError?.message);

                // Provide a more descriptive error if Firebase returns one
                const firebaseMsg = signupError?.message?.includes("auth/email-already-in-use")
                    ? "This screen name is already taken. Try another one."
                    : signupError?.message?.includes("auth/invalid-email")
                        ? "Screen name format is invalid."
                        : "Login/signup failed. Try a different screen name.";

                setError(firebaseMsg);
                return;
            }
        }

        setIsLoggedIn(true);
        setLoginWindowVisible(false);
        setBuddyListVisible(true);
    };

    return (
        <div
            className="min-h-screen flex items-center justify-center bg-cover bg-center"
            style={{ backgroundImage: "url('/login/bliss-bg.jpg')" }}
        >
            {loginWindowVisible && (
                <div
                    ref={loginRef}
                    className="window login-window w-[250px] h-[450px] absolute"
                    id="login-window"
                >
                    <div className="title-bar login-header" id="login-header">
                        <div className="title-bar-text">
                            <img src="/login/running-man.svg" className="h-[16px] inline-block" /> Sign On
                        </div>
                        <div className="title-bar-controls">
                            <button
                                aria-label="Minimize"
                                onClick={() => setLoginWindowVisible(false)}
                            ></button>
                            <button aria-label="Maximize"></button>
                            <button aria-label="Close"></button>
                        </div>
                    </div>

                    <div className="window-body px-1">
                        <div className="bg-[#00008f] py-4 px-7 relative">
                            <img src="/login/logo.svg" alt="AOL Instant Messenger logo" className="w-[90%] h-auto" />
                            <img src="/login/wordmark.svg" alt="AIM wordmark" className="w-full h-auto mt-4" />
                            <p className="text-[#fcce62] text-md italic font-bold absolute bottom-8 right-7">Revival</p>
                        </div>

                        <hr className="mt-2 border-1 border-t-[#9b9287] border-b-[#f9f7fe] border-r-0 border-l-0" />

                        <form onSubmit={handleLogin} className="px-3 py-2">
                            <div>
                                <label htmlFor="screenName" className="block">
                                    <img src="/login/sn-label.png" />
                                </label>
                                <input
                                    name="screenname"
                                    type="text"
                                    id="screenName"
                                    value={screenname}
                                    onChange={(e) => setScreenname(e.target.value)}
                                    className="w-full px-3 bg-white text-black text-sm focus:outline-none border-2 border-l-indigo-500 border-t-indigo-500"
                                />
                                <p className="underline text-[#2b2474]">Get a Screen Name</p>
                            </div>

                            <div className="field-row-stacked">
                                <label htmlFor="passWord" className="block text-black text-sm font-bold mt-2">
                                    Password
                                </label>
                                <input
                                    name="password"
                                    type="password"
                                    id="passWord"
                                    placeholder="Password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="w-full px-3 bg-white text-black text-sm focus:outline-none"
                                />
                            </div>

                            <p className="underline text-[#2b2474] mt-0">Forgot Password?</p>

                            <input type="checkbox" id="savePass" />
                            <label htmlFor="savePass">Save password</label>
                            <input type="checkbox" id="autoLogin" />
                            <label htmlFor="autoLogin">Auto-login</label>

                            <button type="submit" className="mt-2">Sign On</button>
                        </form>

                        {error && (
                            <p className="text-red-600 text-sm mt-3 text-center">{error}</p>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}