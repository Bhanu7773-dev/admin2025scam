import { getAllFundRequestsHandler } from "../controllers/funds.controller.js";

export default function fundsRoutes(fastify) {
    fastify.get('/', getAllFundRequestsHandler)
}
