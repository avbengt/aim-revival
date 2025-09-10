import ChatWindow from "./ChatWindow";
import { Metadata } from "next";

export async function generateMetadata({ searchParams }) {
    const screenname = searchParams.screenname || "Unknown User";
    return {
        title: `Instant Message with ${screenname}`,
    };
}

export default function Page() {
    return <ChatWindow />;
}