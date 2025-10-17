import { getJackpotGameRates, updateJackpotGameRates } from "../services/jackpot.settings.service.js";
import { declareJackpotResult, getJackpotResults, predictJackpotWinners } from "../services/jackpot.game.service.js";

/**
 * Handler to declare or update a Jackpot game result.
 * @route POST /jackpot-results/declare
 */
export async function declareJackpotResultHandler(request, reply) {
    try {
        const { gameId, gameTitle, jodi, declarationDate } = request.body;

        // Basic validation for required fields
        if (!gameId || !gameTitle || !jodi || !declarationDate) {
            return reply.code(400).send({ error: "Missing required fields: gameId, gameTitle, jodi, and declarationDate." });
        }

        const result = await declareJackpotResult({ gameId, gameTitle, jodi, declarationDate });
        return reply.code(201).send(result);

    } catch (error) {
        console.error("Error in declareJackpotResultHandler:", error);
        return reply.code(500).send({ error: error.message || "An internal server error occurred." });
    }
}


/**
 * Handler to fetch Jackpot game results with optional filters.
 * @route GET /jackpot-results
 */
export async function getJackpotResultsHandler(request, reply) {
    try {
        // Filters are passed as query parameters (e.g., /jackpot-results?date=YYYY-MM-DD)
        const { date, gameId } = request.query;

        const results = await getJackpotResults({ date, gameId });
        return reply.send({ data: results });

    } catch (error) {
        console.error("Error in getJackpotResultsHandler:", error);
        return reply.code(500).send({ error: error.message || "An internal server error occurred." });
    }
}


/**
 * Handler to get the combined game rate settings.
 * @route GET /game-rates
 */
export async function getJackpotGameRatesHandler(req, reply) {
    try {
        const rates = await getJackpotGameRates();
        return reply.send({ data: rates });
    } catch (error) {
        console.error("Error in getJackpotGameRatesHandler:", error);
        return reply.code(500).send({ error: "An internal server error occurred." });
    }
}

/**
 * Handler to update the game rate settings.
 * @route PATCH /jackpot-game-rates
 */
export async function updateJackpotGameRatesHandler(req, reply) {
    try {
        const newRates = req.body;
        if (!newRates || Object.keys(newRates).length === 0) {
            return reply.code(400).send({ error: "Request body with rates to update is required." });
        }

        const result = await updateJackpotGameRates(newRates);
        return reply.send(result);
    } catch (error) {
        console.error("Error in updateJackpotGameRatesHandler:", error);
        return reply.code(500).send({ error: error.message });
    }
}

/**
 * Handler to predict winners for a Jackpot game result without saving.
 * @route POST /jackpot-games/results/predict
 */
export async function predictJackpotWinnersHandler(request, reply) {
    try {
        const { gameTitle, jodi, declarationDate } = request.body;

        if (!gameTitle || !jodi || !declarationDate) {
            return reply.code(400).send({ error: "Missing required fields: gameTitle, jodi, and declarationDate." });
        }

        const winners = await predictJackpotWinners({ gameTitle, jodi, declarationDate });
        return reply.send({ data: winners });

    } catch (error) {
        console.error("Error in predictJackpotWinnersHandler:", error);
        return reply.code(500).send({ error: error.message || "An internal server error occurred." });
    }
}
