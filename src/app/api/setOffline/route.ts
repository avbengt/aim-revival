import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/firebase";
import { doc, updateDoc } from "firebase/firestore";

export async function POST(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const uid = searchParams.get("uid");

    if (!uid) return NextResponse.json({ success: false });

    try {
        await updateDoc(doc(db, "users", uid), {
            online: false,
        });
        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Failed to set offline:", error);
        return NextResponse.json({ success: false });
    }
}