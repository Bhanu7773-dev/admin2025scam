import {
    getAllFundsHandler,
    updateFundRequestStatusHandler,
    updateWithdrawalRequestStatusHandler
} from "../controllers/funds.controller.js";

export default async function fundsRoutes(fastify) {
    /**
     * @description Get all fund requests (deposits) and withdrawals, aggregated.
     * @route GET /funds
     */
    fastify.get('/', getAllFundsHandler);

    /**
     * @description Update the status of a specific fund request (deposit).
     * @route PATCH /funds/deposits/:requestId
     * @bodyparam {string} status - The new status ('approved' or 'rejected').
     */
    fastify.patch('/deposits/:requestId', updateFundRequestStatusHandler);

    /**
     * @description Update the status of a specific withdrawal request.
     * @route PATCH /funds/withdrawals/:requestId
     * @bodyparam {string} status - The new status ('approved' or 'rejected').
     */
    fastify.patch('/withdrawals/:requestId', updateWithdrawalRequestStatusHandler);
}