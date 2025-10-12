import {
    createUser,
    getAllUsers,
    getUser,
    updateUserStatus,
    updateUser,
    deleteUser,
    createAdmin,
    updateUserPassword
} from "../services/users.service.js";
import { getFundsOfUser, getFundTransactionsForUser } from "../services/funds.service.js";
import { getWithdrawlRequestsForUser } from "../services/withdrawl.service.js";
import { getBiddingOfUser } from "../services/bidding.service.js";

/**
 * Handler to create a new user (non-admin).
 * @route POST /users
 */
export async function createUserHandler(req, reply) {
    try {
        const { name, phone, password, username, isSubAdmin } = req.body;
        if (!name || !phone || !password || !username) {
            return reply.code(400).send({ error: "Missing required fields: name, phone, password, username." });
        }

        const newUser = await createUser({ name, phone, password, username, isSubAdmin });
        return reply.code(201).send({ data: newUser });

    } catch (error) {
        console.error("Error in createUserHandler:", error.message);
        if (error.message.includes("already exists")) {
            return reply.code(409).send({ error: error.message });
        }
        return reply.code(500).send({ error: "An internal server error occurred." });
    }
}

/**
 * Handler to create a new main administrator.
 * @route POST /admins
 */
export async function createAdminHandler(req, reply) {
    try {
        const { name, phone, password, username } = req.body;
        if (!name || !phone || !password || !username) {
            return reply.code(400).send({ error: "Missing required fields: name, phone, password, username." });
        }
        const newAdmin = await createAdmin({ name, phone, password, username });
        return reply.code(201).send({ data: newAdmin });
    } catch (error) {
        console.error("Error in createAdminHandler:", error.message);
        if (error.message.includes("already exists")) {
            return reply.code(409).send({ error: error.message });
        }
        return reply.code(500).send({ error: "An internal server error occurred." });
    }
}

/**
 * Handler to get a list of all users with pagination.
 * @route GET /users
 */
export async function getAllUsersHandler(req, reply) {
    try {
        const { limit, startAfterId, includeAdmins } = req.query;
        const result = await getAllUsers({
            limit: Number(limit) || 20,
            startAfterId: startAfterId || null,
            includeSubAdmins: includeAdmins === "true"
        });
        reply.send({ data: result });
    } catch (err) {
        console.error("Error in getAllUsersHandler:", err);
        reply.status(500).send({ error: err instanceof Error ? err.message : "Unknown error" });
    }
}

/**
 * Handler to get a single user by their UID.
 * @route GET /users/:uid
 */
export async function getUserHandler(req, reply) {
    try {
        const { uid } = req.params;
        if (!uid) return reply.status(400).send({ error: "User ID (uid) is required" });

        const user = await getUser(uid);
        if (!user) return reply.status(404).send({ error: "User not found" });

        reply.send({ data: user });
    } catch (err) {
        console.error("Error in getUserHandler:", err);
        reply.status(500).send({ error: err.message });
    }
}

/**
 * Handler to update a user's details (name, username, mpin, etc.).
 * @route PATCH /users/:uid
 */
export async function updateUserHandler(req, reply) {
    try {
        const { uid } = req.params;
        const updateData = req.body;

        if (!updateData || Object.keys(updateData).length === 0) {
            return reply.code(400).send({ error: "Request body must contain fields to update." });
        }
        
        const result = await updateUser({ uid, data: updateData });
        reply.send({ data: result });
    } catch (error) {
        console.error(`Error in updateUserHandler for uid ${req.params.uid}:`, error);
        reply.code(500).send({ error: error.message });
    }
}

/**
 * Handler to update a user's password.
 * @route PATCH /users/:uid/password
 */
export async function updateUserPasswordHandler(req, reply) {
    try {
        const { uid } = req.params;
        const { password } = req.body;

        if (!password) {
            return reply.code(400).send({ error: "A 'password' field is required." });
        }
        
        const result = await updateUserPassword({ uid, password });
        return reply.send({ data: result });
    } catch (error) {
        console.error(`Error in updateUserPasswordHandler for uid ${req.params.uid}:`, error);
        return reply.code(500).send({ error: error.message });
    }
}

/**
 * Handler to update a user's active/inactive status.
 * @route PATCH /users/:uid/status
 */
export async function updateUserStatusHandler(req, reply) {
    try {
        const { uid } = req.params;
        const result = await updateUserStatus({uuid: uid});
        reply.send({ data: result });
    } catch (error) {
        console.error(`Error in updateUserStatusHandler for uid ${req.params.uid}:`, error);
        reply.code(500).send({ error: error.message });
    }
}

/**
 * Handler to delete a user.
 * @route DELETE /users/:uid
 */
export async function deleteUserHandler(req, reply) {
    try {
        const { uid } = req.params;
        const result = await deleteUser({ uid });
        reply.send({ data: result });
    } catch (error) {
        console.error(`Error in deleteUserHandler for uid ${req.params.uid}:`, error);
        reply.code(500).send({ error: error.message });
    }
}

/**
 * Handler to get a user's fund information (balance, etc.).
 * @route GET /users/:uid/funds
 */
export async function getUserFundsHandler(req, reply) {
    try {
        const { uid } = req.params;
        if (!uid) return reply.status(400).send({ error: "User ID (uid) is required" });

        const funds = await getFundsOfUser({ uuid: uid });
        reply.send({ data: funds });
    } catch (err) {
        console.error("Error in getUserFundsHandler:", err);
        reply.status(500).send({ error: err instanceof Error ? err.message : "Unknown error" });
    }
}

/**
 * Handler to get a user's withdrawal requests.
 * @route GET /users/:uid/withdrawals
 */
export async function getUserWithdrawlsHandler(req, reply) {
    try {
        const { uid } = req.params;
        if (!uid) return reply.status(400).send({ error: "User ID (uid) is required" });

        const withdrawls = await getWithdrawlRequestsForUser({ uuid: uid });
        reply.send({ data: withdrawls });
    } catch (err) {
        console.error("Error in getUserWithdrawlsHandler:", err);
        reply.status(500).send({ error: err instanceof Error ? err.message : "Unknown error" });
    }
}

/**
 * Handler to get a user's fund transaction history.
 * @route GET /users/:uid/transactions
 */
export async function getUserFundTransactionsHandler(req, reply) {
    try {
        const { uid } = req.params;
        if (!uid) return reply.status(400).send({ error: "User ID (uid) is required" });

        const transactions = await getFundTransactionsForUser({ uuid: uid });
        reply.send({ data: transactions });
    } catch (err) {
        console.error("Error in getUserFundTransactionsHandler:", err);
        reply.status(500).send({ error: err instanceof Error ? err.message : "Unknown error" });
    }
}

/**
 * Handler to get a user's bidding history.
 * @route GET /users/:uid/biddings
 */
export async function getUserBiddingsHandler(req, reply) {
    try {
        const { uid } = req.params;
        if (!uid) return reply.status(400).send({ error: "User ID (uid) is required" });

        const biddings = await getBiddingOfUser({ uuid: uid });
        reply.send({ data: biddings });
    } catch (err) {
        console.error("Error in getUserBiddingsHandler:", err);
        reply.status(500).send({ error: err instanceof Error ? err.message : "Unknown error" });
    }
}