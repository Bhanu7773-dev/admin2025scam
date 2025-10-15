import { updateUserBalanceHandler } from "../controllers/funds.controller.js";
import {
    createUserHandler,
    getAllUsersHandler,
    getUserHandler,
    updateUserHandler,
    updateUserStatusHandler,
    deleteUserHandler,
    getUserFundsHandler,
    getUserFundTransactionsHandler,
    getUserWithdrawlsHandler,
    getUserBiddingsHandler,
    updateUserPasswordHandler,
    getUserDepositsHandler
} from "../controllers/users.controller.js";
import { admin, db } from "../plugins/firebase.js";

export default async function usersRoutes(fastify) {
    // CREATE a new user
    fastify.post("/", createUserHandler);

    // READ all users (paginated)
    fastify.get("/", getAllUsersHandler);

    // --- Routes for a specific user ID ---

    // READ a single user's details
    fastify.get("/:uid", getUserHandler);

    // UPDATE a user's name/username
    fastify.patch("/:uid", updateUserHandler);

    // UPDATE a user's active/inactive status
    fastify.patch("/:uid/status", updateUserStatusHandler);

    // UPDATE a user's balance
    fastify.post("/:uid/balance", updateUserBalanceHandler);

    // UPDATE a user's password
    fastify.patch("/:uid/password", updateUserPasswordHandler)

    // DELETE a user
    fastify.delete("/:uid", deleteUserHandler);

    // READ a user's related data
    fastify.get("/:uid/funds", getUserFundsHandler);
    fastify.get("/:uid/transactions", getUserFundTransactionsHandler);
    fastify.get("/:uid/withdrawals", getUserWithdrawlsHandler);
    fastify.get("/:uid/biddings", getUserBiddingsHandler);
    fastify.get("/:uid/deposits", getUserDepositsHandler );

    fastify.get("/existing-user/:phone", async (req, rep) => {
        try {
            const { phone } = req.params;
            const email = `${phone}@sara777.com`
            if (!email) {
                return rep.code(400).send({ error: "Invalid phone probably" });
            }

            const exists = await checkEmailExists({ email });

            return rep.send({ exists });

        } catch (error) {
            console.error("Error in checkEmailExistsHandler:", error.message);
            return rep.code(500).send({ error: "An internal server error occurred while checking email." });
        }
    })
}

/**
 * Checks if an email exists in Firebase Auth or the users Firestore collection.
 * @param {object} payload
 * @param {string} payload.email - The email to check.
 * @returns {Promise<{exists: boolean, in?: 'auth' | 'firestore'}>} An object indicating if the email exists and where.
 */
export async function checkEmailExists({ email }) {
    // Step 1: Check Firebase Authentication
    try {
        // 2. Use admin.auth() here
        await admin.auth().getUserByEmail(email);
        // If the above line does not throw an error, the user exists in Auth.
        return { exists: true, in: 'auth' };
    } catch (error) {
        // 'auth/user-not-found' is the expected error if the email is not in Auth.
        if (error.code !== 'auth/user-not-found') {
            console.warn(`Auth check for ${email} failed with unexpected error:`, error.code);
        }
    }

    // Step 2: Check Firestore 'users' collection (This part was already correct)
    const usersRef = db.collection('users');
    const snapshot = await usersRef.where('email', '==', email).limit(1).get();

    if (!snapshot.empty) {
        return { exists: true, in: 'firestore' };
    }

    return { exists: false };
}