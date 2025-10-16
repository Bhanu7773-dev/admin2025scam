import {
    getAllBiddingsHandler,
    revertBidsHandler,
    getBiddingByIdHandler,
    getPredictionHandler,
    declareManualResultHandler,
    declareAutomaticResultHandler,
    updateBiddingHandler,
    revertBidsByCriteriaHandler,
    clearRevertedBidsHandler
} from "../controllers/bidding.controller.js";
import { declareResultHandler } from "../services/game.service.js";


export default async function biddingRoutes(fastify) {
    /**
     * @description Get a paginated list of all game submissions (biddings).
     * @route GET /biddings
     */
    fastify.get("/", getAllBiddingsHandler);

    /**
     * @description Revert all bids for a specific date and refund users.
     * @route POST /biddings/revert
     */
    fastify.post("/revert", revertBidsHandler);

    /**
     * @description Predict potential winners for a hypothetical result.
     * @route POST /biddings/predict
     */
    fastify.post("/predict", getPredictionHandler);

    /**
     * @description Get a single game submission by its document ID.
     * @route GET /biddings/:id
     */
    fastify.get("/:id", getBiddingByIdHandler);

    /**
     * @description Update the details of a specific bid.
     * @route PATCH /biddings/:id
     */
    fastify.patch("/:id", updateBiddingHandler);

    /**
     * @description Declare a result and process all related bids.
     * @route POST /biddings/declare
     */
    fastify.post("/declare", declareResultHandler);

    /**
     * @description Manually declare a result and process bids.
     * @route POST /biddings/declare-manual
     */
    fastify.post("/declare-manual", declareManualResultHandler);

    /**
     * @description Automatically declare results for a date using the scraper.
     * @route POST /biddings/declare-automatic
     */
    fastify.post("/declare-automatic", declareAutomaticResultHandler);

    /**
     * @description Revert bids based on specific criteria (date and/or gameId).
     * @route POST /biddings/revert-by-criteria
     */
    fastify.post("/revert-by-criteria", revertBidsByCriteriaHandler);

    /**
     * @description Clear (delete) already reverted bids based on specific criteria.
     * @route POST /biddings/clear-reverted
     */
    fastify.post("/clear-reverted", clearRevertedBidsHandler);
}