import {
    getAllFunds,
    getFundTransactionsForUser,
    updateFundRequestStatus,
    updateWithdrawalRequestStatus,
    updateUserBalance
} from "../services/funds.service.js";

/**
 * Handler to get all fund requests and withdrawals, aggregated.
 * This is the main endpoint for the /fund-requests route.
 */
export async function getAllFundsHandler(req, rep) {
    try {
        // This function doesn't need pagination as it fetches two distinct collections.
        // If individual lists get very long, they should have their own paginated endpoints.
        const data = await getAllFunds();
        rep.send({ data });
    } catch (err) {
        console.error("Error in getAllFundsHandler:", err);
        rep.status(500).send({ error: err.message });
    }
}

/**
 * Handler for updating the status of a fund request (deposit).
 */
export async function updateFundRequestStatusHandler(req, rep) {
    try {
        const { requestId } = req.params;
        const { status } = req.body;

        if (!requestId || !status) {
            return rep.status(400).send({ error: "Request ID and status are required." });
        }

        const result = await updateFundRequestStatus({
            requestId,
            newStatus: status
        });

        rep.send(result);
    } catch (err) {
        console.error("Error in updateFundRequestStatusHandler:", err);
        rep.status(500).send({ error: err.message });
    }
}

/**
 * Handler for updating the status of a withdrawal request.
 */
export async function updateWithdrawalRequestStatusHandler(req, rep) {
    try {
        const { requestId } = req.params;
        const { status } = req.body;

        if (!requestId || !status) {
            return rep.status(400).send({ error: "Request ID and status are required." });
        }

        const result = await updateWithdrawalRequestStatus({
            requestId,
            newStatus: status
        });

        rep.send(result);
    } catch (err) {
        console.error("Error in updateWithdrawalRequestStatusHandler:", err);
        rep.status(500).send({ error: err.message });
    }
}

/**
 * Handler to get all fund transactions (credit/debit history) for a specific user.
 */
export async function getFundTransactionsForUserHandler(req, rep) {
    try {
        const { uuid } = req.params;
        if (!uuid) {
            return rep.status(400).send({ error: "User ID (uuid) is required." });
        }
        const transactions = await getFundTransactionsForUser({ uuid });
        rep.send({ data: transactions });
    } catch (err) {
        console.error("Error in getFundTransactionsForUserHandler:", err);
        rep.status(500).send({ error: err.message });
    }
}

/**
 * Handler to manually add (credit) or subtract (debit) funds from a user's balance.
 */
export async function updateUserBalanceHandler(req, rep) {
    try {
        const { uid } = req.params;
        const { amount, reason } = req.body;

        if (!uid || typeof amount !== 'number' || !reason) {
            return rep.status(400).send({ error: "User ID (uid), a numeric 'amount', and a 'reason' string are required." });
        }

        const result = await updateUserBalance({ uid, amount, reason });
        rep.send({ data: result });
    } catch (error) {
        console.error(`Error in updateUserBalanceHandler for uid ${uid}:`, error);
        rep.status(500).send({ error: error.message });
    }
}