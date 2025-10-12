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
    getUserBiddingsHandler
} from "../controllers/users.controller.js";

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

    // DELETE a user
    fastify.delete("/:uid", deleteUserHandler);

    // READ a user's related data
    fastify.get("/:uid/funds", getUserFundsHandler);
    fastify.get("/:uid/transactions", getUserFundTransactionsHandler);
    fastify.get("/:uid/withdrawals", getUserWithdrawlsHandler);
    fastify.get("/:uid/biddings", getUserBiddingsHandler);
}