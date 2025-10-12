import { admin } from "../plugins/firebase.js";
import { sendNotification, sendMulticastNotification } from "../services/notification.service.js";

/**
 * Handler to send a push notification to a single user or all users.
 * @route POST /notifications/send
 */
export async function sendNotificationHandler(request, reply) {
    try {
        const { title, body, userId } = request.body;

        if (!title || !body) {
            return reply.code(400).send({ error: "Request body must include 'title' and 'body'." });
        }

        // --- CASE 1: Send to ALL users ---
        if (!userId) {
            console.log("Broadcast request received. Fetching all user tokens...");
            const usersSnapshot = await admin.firestore().collection('users').get();
            
            const tokens = [];
            usersSnapshot.forEach(doc => {
                const fcmToken = doc.data().fcmToken;
                if (fcmToken) {
                    tokens.push(fcmToken);
                }
            });

            if (tokens.length === 0) {
                return reply.send({ success: true, message: "No users with notification tokens found." });
            }

            const result = await sendMulticastNotification({ tokens, title, body });
            return reply.send({ success: true, message: `Broadcast sent to ${tokens.length} tokens.`, ...result });
        }

        // --- CASE 2: Send to a SINGLE user ---
        console.log(`Single user notification request for UID: ${userId}`);
        const userDoc = await admin.firestore().collection('users').doc(userId).get();

        if (!userDoc.exists) {
            return reply.code(404).send({ error: `User with ID ${userId} not found.` });
        }

        const fcmToken = userDoc.data().fcmToken;
        if (!fcmToken) {
            return reply.code(400).send({ error: `User ${userId} does not have a notification token.` });
        }

        const result = await sendNotification({ token: fcmToken, title, body });
        
        if (!result.success) {
            // If the token is invalid, you might want to clear it from the user's profile
            if (result.error === 'messaging/registration-token-not-registered') {
                console.log(`Invalid token for user ${userId}. Clearing from profile.`);
                await admin.firestore().collection('users').doc(userId).update({ fcmToken: null });
            }
            return reply.code(500).send({ error: `Failed to send notification: ${result.error}` });
        }
        
        return reply.send({ success: true, message: `Notification sent successfully to user ${userId}.` });

    } catch (error) {
        console.error("Error in sendNotificationHandler:", error);
        return reply.code(500).send({ error: "An internal server error occurred." });
    }
}
