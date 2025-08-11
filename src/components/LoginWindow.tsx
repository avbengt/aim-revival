"use client";

import { useEffect, useRef, useState } from "react";
import { signInWithEmailAndPassword, createUserWithEmailAndPassword } from "firebase/auth";
import { doc, setDoc } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { useWindowManager } from "@context/WindowManagerContext";
import { useDraggableWindow } from "@/hooks/useDraggableWindow";

export default function LoginWindow() {
    const { loginWindowVisible, setLoginWindowVisible, setBuddyListVisible } = useWindowManager();
    const winRef = useRef<HTMLDivElement>(null);

    useDraggableWindow(winRef, {
        headerSelector: ".login-header",
        disabled: !loginWindowVisible,
        storageKey: "pos_login_window",
        centerOnFirstPaint: true,
    });

    const [screenname, setScreenname] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");

    // Prevent initial top-left flash until positioned
    useEffect(() => {
        const el = winRef.current;
        if (!el) return;
        el.style.visibility = "visible";
    }, [loginWindowVisible]);

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
            await signInWithEmailAndPassword(auth, email, password);
        } catch {
            try {
                const cred = await createUserWithEmailAndPassword(auth, email, password);
                await setDoc(doc(db, "users", cred.user.uid), { screenname });
            } catch (err: unknown) {
                const msg = err?.message?.includes("auth/email-already-in-use")
                    ? "This screen name is already taken. Try another one."
                    : "Login/signup failed. Try a different screen name.";
                setError(msg);
                return;
            }
        }

        setLoginWindowVisible(false);
        setBuddyListVisible(true);
    };

    if (!loginWindowVisible) return null;

    return (
        <>
            {loginWindowVisible && (
                <div
                    ref={winRef}
                    id="login-window"
                    className="window login-window w-[250px] h-[450px] absolute z-50"
                >
                    <div className="title-bar login-header" id="login-header">
                        <div className="title-bar-text">
                            <img src="/login/running-man.svg" className="h-[16px] inline-block" /> Sign On
                        </div>
                        <div className="title-bar-controls">
                            <button aria-label="Minimize" onClick={() => setLoginWindowVisible(false)} />
                            <button aria-label="Maximize" />
                            <button aria-label="Close" />
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
                                    id="screenName"
                                    name="screenname"
                                    value={screenname}
                                    onChange={(e) => setScreenname(e.target.value)}
                                    className="w-full px-3 bg-white text-black text-sm focus:outline-none border-2 border-l-indigo-500 border-t-indigo-500"
                                    type="text"
                                />
                                <p className="underline text-[#2b2474]">Get a Screen Name</p>
                            </div>

                            <div className="field-row-stacked">
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

                        {error && <p className="text-red-600 text-sm mt-3 text-center">{error}</p>}
                    </div>
                </div>
            )}
        </>
    );
}