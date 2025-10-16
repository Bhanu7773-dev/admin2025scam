import * as biddingService from "../services/bidding.service.js";
import { getPrediction, processGameResults } from "../services/game.service.js";

/**
 * Handler to get all bidding history for a specific user.
 * @route GET /users/:uuid/biddings
 */
export async function getUserBiddingsHandler(request, reply) {
    try {
        const { uuid } = request.params;
        if (!uuid) {
            return reply.code(400).send({ error: "User ID (uuid) is required." });
        }
        const biddings = await biddingService.getBiddingOfUser({ uuid });
        return reply.send({ data: biddings });
    } catch (error) {
        console.error(`Error fetching biddings for user ${request.params.uuid}:`, error);
        return reply.code(500).send({ error: "An internal server error occurred." });
    }
}

/**
 * Handler to get a paginated list of all biddings from all users.
 * @route GET /biddings
 */
export async function getAllBiddingsHandler(request, reply) {
    try {
        const { limit, startAfterId } = request.query;
        const result = await biddingService.getAllBiddings({
            limit: Number(limit) || 20,
            startAfterId: startAfterId || null,
        });
        return reply.send({ data: result });
    } catch (error) {
        console.error("Error in getAllBiddingsHandler:", error);
        return reply.code(500).send({ error: "An internal server error occurred." });
    }
}

/**
 * Handler to get a single bidding by its document ID.
 * @route GET /biddings/:id
 */
export async function getBiddingByIdHandler(request, reply) {
    try {
        const { id } = request.params;
        const bidding = await biddingService.getBiddingById({ id });
        if (!bidding) {
            return reply.code(404).send({ error: "Bidding submission not found." });
        }
        return reply.send({ data: bidding });
    } catch (error) {
        console.error(`Error fetching bidding ${request.params.id}:`, error);
        return reply.code(500).send({ error: "An internal server error occurred." });
    }
}

/**
 * Handler to revert all bids for a specific date.
 * @route POST /biddings/revert
 */
export async function revertBidsHandler(request, reply) {
    try {
        const { date } = request.body;
        if (!date) {
            return reply.code(400).send({ error: "A 'date' (YYYY-MM-DD) is required in the request body." });
        }
        const result = await biddingService.revertBids({ date });
        return reply.send(result);
    } catch (error) {
        console.error("Error in revertBidsHandler:", error);
        return reply.code(500).send({ error: error.message });
    }
}

/**
 * Handler to predict potential winners for a hypothetical result without updating the database.
 * @route POST /biddings/predict
 */
export async function getPredictionHandler(request, reply) {
    try {
        const { gameId, date, type, openPanna, closePanna } = request.body;
        if (!gameId || !date || !openPanna || !closePanna) {
            return reply.code(400).send({ error: "Required fields are missing. 'gameId', 'date', 'openPanna', and 'closePanna' are mandatory." });
        }
        const predictionDate = new Date(date);
        if (isNaN(predictionDate.getTime())) {
            return reply.code(400).send({ error: "Invalid 'date' format. Please use a valid date string like YYYY-MM-DD." });
        }
        const winners = await getPrediction({ gameId, date: predictionDate, type: type || null, openPanna, closePana });
        return reply.send({ data: winners });
    } catch (error) {
        console.error("Error in getPredictionHandler:", error);
        return reply.code(500).send({ error: error.message || "An internal server error occurred." });
    }
}

/**
 * Handler to update the details of a specific bid.
 * @route PATCH /biddings/:id
 */
export async function updateBiddingHandler(request, reply) {
    try {
        const { id } = request.params;
        const updateData = request.body;
        if (!updateData || Object.keys(updateData).length === 0) {
            return reply.code(400).send({ error: "Request body must contain fields to update." });
        }
        const result = await biddingService.updateBidding({ bidId: id, data: updateData });
        return reply.send(result);
    } catch (error) {
        console.error(`Error in updateBiddingHandler for bid ${request.params.id}:`, error);
        return reply.code(500).send({ error: error.message });
    }
}

/**
 * Handler for MANUAL result declaration. Uses an overrideList.
 * @route POST /biddings/declare-manual
 */
export async function declareManualResultHandler(request, reply) {
    try {
        const { gameId, date, openPana, closePana } = request.body;
        if (!gameId || !date || !openPana || !closePana) {
            return reply.code(400).send({ error: "Required fields: 'gameId', 'date', 'openPana', 'closePana'." });
        }
        const resultDate = new Date(date);
        if (isNaN(resultDate.getTime())) {
            return reply.code(400).send({ error: "Invalid 'date' format. Use YYYY-MM-DD." });
        }
        const startDate = new Date(resultDate);
        startDate.setHours(0, 0, 0, 0);
        const endDate = new Date(resultDate);
        endDate.setHours(23, 59, 59, 999);
        const sumDigits = (numStr) => String(numStr).split('').reduce((sum, digit) => sum + parseInt(digit, 10), 0) % 10;
        const overrideList = {
            [gameId]: {
                firstHalf: `${sumDigits(openPana)}-${openPana}`,
                secondHalf: `${sumDigits(closePana)}-${closePana}`,
            }
        };
        const summary = await processGameResults({ startDate, endDate, overrideList });
        return reply.send({ success: true, message: "Manual result declared successfully.", data: summary });
    } catch (error) {
        console.error("Error in declareManualResultHandler:", error);
        return reply.code(500).send({ error: error.message || "An internal error occurred." });
    }
}

/**
 * Handler for AUTOMATIC result declaration. Uses the web scraper.
 * @route POST /biddings/declare-automatic
 */
export async function declareAutomaticResultHandler(request, reply) {
    try {
        const { date } = request.body;
        if (!date) {
            return reply.code(400).send({ error: "A 'date' (YYYY-MM-DD) is required." });
        }
        const resultDate = new Date(date);
        if (isNaN(resultDate.getTime())) {
            return reply.code(400).send({ error: "Invalid 'date' format. Use YYYY-MM-DD." });
        }
        const startDate = new Date(resultDate);
        startDate.setHours(0, 0, 0, 0);
        const endDate = new Date(resultDate);
        endDate.setHours(23, 59, 59, 999);
        const summary = await processGameResults({ startDate, endDate });
        return reply.send({ success: true, message: "Automatic result declaration initiated.", data: summary });
    } catch (error) {
        console.error("Error in declareAutomaticResultHandler:", error);
        return reply.code(500).send({ error: error.message || "An internal server error occurred." });
    }
}

// --- NEW HANDLERS ADDED BELOW ---

/**
 * Handler to revert bids based on specific criteria (date and/or gameId).
 * @route POST /biddings/revert-by-criteria
 */
export async function revertBidsByCriteriaHandler(request, reply) {
    try {
        const { date, gameId } = request.body;
        if (!date && !gameId) {
            return reply.code(400).send({ error: "At least one criterion ('date' or 'gameId') is required." });
        }
        const result = await biddingService.revertBidsByCriteria({ date, gameId });
        return reply.send(result);
    } catch (error) {
        console.error("Error in revertBidsByCriteriaHandler:", error);
        return reply.code(500).send({ error: error.message });
    }
}

/**
 * Handler to clear (delete) already reverted bids based on specific criteria.
 * @route POST /biddings/clear-reverted
 */
export async function clearRevertedBidsHandler(request, reply) {
    try {
        const { date, gameId } = request.body;
        if (!date && !gameId) {
            return reply.code(400).send({ error: "At least one criterion ('date' or 'gameId') is required." });
        }
        const result = await biddingService.clearRevertedBids({ date, gameId });
        return reply.send(result);
    } catch (error) {
        console.error("Error in clearRevertedBidsHandler:", error);
        return reply.code(500).send({ error: error.message });
    }
}