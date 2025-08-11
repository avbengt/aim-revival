import * as functions from "firebase-functions";
import * as admin from "firebase-admin";

admin.initializeApp({
    credential: admin.credential.applicationDefault(),
    databaseURL: "https://aim-revival-default-rtdb.firebaseio.com"
});

export const onUserStatusChanged = functions.database
    .ref("/status/{uid}")
    .onDelete(async (snapshot: functions.database.DataSnapshot, context: functions.EventContext) => {
        const uid = context.params.uid;

        try {
            const userRef = admin.firestore().collection("users").doc(uid);
            await userRef.update({
                online: false,
                lastSeen: admin.firestore.FieldValue.serverTimestamp(),
            });
        } catch (error) {
            console.error("Error updating Firestore user status:", error);
        }
    });