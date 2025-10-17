import { getJackpotGameRatesHandler, updateJackpotGameRatesHandler } from "../controllers/jackpot.settings.controller.js";
import {
    getSettingsHandler,
    updateSettingsHandler,
    getGameRatesHandler, 
    updateGameRatesHandler   
} from "../controllers/settings.controller.js";
import { getStarlineGameRatesHandler, updateStarlineGameRatesHandler } from "../controllers/starline.settings.controller.js";

/**
 * Encapsulates routes related to general application settings.
 * @param {import("fastify").FastifyInstance} fastify - The Fastify instance.
 */
export function settingsRoutes(fastify) {
    /**
     * @description Get all application settings combined into one object.
     * @route GET /settings
     */
    fastify.get('/', getSettingsHandler);

    /**
     * @description Update one or more application settings.
     * @route PATCH /settings
     * @bodyparam {object} - A flat object containing the settings fields to update.
     */
    fastify.patch('/', updateSettingsHandler);
}

/**
 * Encapsulates routes related to game rate settings.
 * @param {import("fastify").FastifyInstance} fastify - The Fastify instance.
 */
export function gameRatesRoutes(fastify) {
    /**
     * @description Get all game rates combined into one object.
     * @route GET /game-rates
     */
    fastify.get('/', getGameRatesHandler);

    /**
     * @description Update one or more game rates.
     * @route PATCH /game-rates
     * @bodyparam {object} - A flat object containing the rate fields to update.
     */
    fastify.patch('/', updateGameRatesHandler);
}

/**
 * Encapsulates routes related to game rate settings.
 * @param {import("fastify").FastifyInstance} fastify - The Fastify instance.
 */
export function starlineGameRatesRoutes(fastify) {
    /**
     * @description Get all game rates combined into one object.
     * @route GET /starline-game-rates
     */
    fastify.get('/', getStarlineGameRatesHandler);

    /**
     * @description Update one or more game rates.
     * @route PATCH /game-rates
     * @bodyparam {object} - A flat object containing the rate fields to update.
     */
    fastify.patch('/', updateStarlineGameRatesHandler);
}

/**
 * Encapsulates routes related to game rate settings.
 * @param {import("fastify").FastifyInstance} fastify - The Fastify instance.
 */
export function jackpotGameRatesRoutes(fastify) {
    /**
     * @description Get all game rates combined into one object.
     * @route GET /jackpot-game-rates
     */
    fastify.get('/', getJackpotGameRatesHandler);

    /**
     * @description Update one or more game rates.
     * @route PATCH /game-rates
     * @bodyparam {object} - A flat object containing the rate fields to update.
     */
    fastify.patch('/', updateJackpotGameRatesHandler);
}