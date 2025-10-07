import { getDashboardHandler } from "../controllers/dashboard.controller.js";

import { getNormalUsersHandler } from "../controllers/dashboard.controller.js";

import { getAllAppSettingsHandler } from "../controllers/dashboard.controller.js";

import { getAppSettingHandler } from "../controllers/dashboard.controller.js";

import { getDepositsHandler } from "../controllers/dashboard.controller.js";

import { getWithdrawlHandler } from "../controllers/dashboard.controller.js";

import { getFundsHandler } from "../controllers/dashboard.controller.js";

import { getFundsTransactionsHandler } from "../controllers/dashboard.controller.js";

import { getGameSubmissionsHandler } from "../controllers/dashboard.controller.js";

export default async function adminRoutes(fastify) {
    fastify.get('/dashboard', getDashboardHandler)
    fastify.get('/users', getNormalUsersHandler)
    fastify.get('/app_settings', getAllAppSettingsHandler)
    fastify.get('/app_settings/:docId', getAppSettingHandler)
    fastify.get('/deposits', getDepositsHandler)
    fastify.get('/withdrawl', getWithdrawlHandler)
    fastify.get('/funds', getFundsHandler)
    fastify.get('/funds_transactions', getFundsTransactionsHandler)
    fastify.get('/game_submissions', getGameSubmissionsHandler)
}