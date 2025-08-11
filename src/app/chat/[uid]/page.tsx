import ChatWindow from "./ChatWindow";
import { Metadata } from "next";

export async function generateMetadata({
    searchParams,
}: {
    searchParams: { screenname?: string };
}): Promise<Metadata> {
    const screenname = searchParams.screenname || "Unknown User";
    return {
        title: `Instant Message with ${screenname}`,
    };
}

export default function Page() {
    return <ChatWindow />;
}