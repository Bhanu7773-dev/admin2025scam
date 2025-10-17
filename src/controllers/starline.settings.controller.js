import { getStarlineGameRates, updateStarlineGameRates } from "../services/starline.settings.service.js";
import { declareStarlineResult, getStarlineResults, predictStarlineWinners } from "../services/starline.game.service.js";

/**
 * Handler to declare or update a Starline game result.
 * @route POST /starline-results/declare
 */
export async function declareStarlineResultHandler(request, reply) {
    try {
        const { gameId, gameTitle, openingPanna, declarationDate } = request.body;

        // Basic validation for required fields
        if (!gameId || !gameTitle || !openingPanna || !declarationDate) {
            return reply.code(400).send({ error: "Missing required fields: gameId, gameTitle, openingPanna, and declarationDate." });
        }

        const result = await declareStarlineResult({ gameId, gameTitle, openingPanna, declarationDate });
        return reply.code(201).send(result);

    } catch (error) {
        console.error("Error in declareStarlineResultHandler:", error);
        return reply.code(500).send({ error: error.message || "An internal server error occurred." });
    }
}


/**
 * Handler to fetch Starline game results with optional filters.
 * @route GET /starline-results
 */
export async function getStarlineResultsHandler(request, reply) {
    try {
        // Filters are passed as query parameters (e.g., /starline-results?date=YYYY-MM-DD)
        const { date, gameId } = request.query;

        const results = await getStarlineResults({ date, gameId });
        return reply.send({ data: results });

    } catch (error) {
        console.error("Error in getStarlineResultsHandler:", error);
        return reply.code(500).send({ error: error.message || "An internal server error occurred." });
    }
}


/**
 * Handler to get the combined game rate settings.
 * @route GET /game-rates
 */
export async function getStarlineGameRatesHandler(req, reply) {
    try {
        const rates = await getStarlineGameRates();
        return reply.send({ data: rates });
    } catch (error) {
        console.error("Error in getStarlineGameRatesHandler:", error);
        return reply.code(500).send({ error: "An internal server error occurred." });
    }
}

/**
 * Handler to update the game rate settings.
 * @route PATCH /starline-game-rates
 */
export async function updateStarlineGameRatesHandler(req, reply) {
    try {
        const newRates = req.body;
        if (!newRates || Object.keys(newRates).length === 0) {
            return reply.code(400).send({ error: "Request body with rates to update is required." });
        }

        const result = await updateStarlineGameRates(newRates);
        return reply.send(result);
    } catch (error) {
        console.error("Error in updateStarlineGameRatesHandler:", error);
        return reply.code(500).send({ error: error.message });
    }
}

/**
 * Handler to predict winners for a Starline game result without saving.
 * @route POST /starline-games/results/predict
 */
export async function predictStarlineWinnersHandler(request, reply) {
    try {
        const { gameTitle, openingPanna, declarationDate } = request.body;

        if (!gameTitle || !openingPanna || !declarationDate) {
            return reply.code(400).send({ error: "Missing required fields: gameTitle, openingPanna, and declarationDate." });
        }

        const winners = await predictStarlineWinners({ gameTitle, openingPanna, declarationDate });
        return reply.send({ data: winners });

    } catch (error) {
        console.error("Error in predictStarlineWinnersHandler:", error);
        return reply.code(500).send({ error: error.message || "An internal server error occurred." });
    }
}
