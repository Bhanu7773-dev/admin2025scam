import {
    getSettings,
    updateSettings,
    getGameRates,      // <-- Import new service
    updateGameRates    // <-- Import new service
} from "../services/settings.service.js";


// ===================================================================
// == App Settings Handlers ==
// ===================================================================

/**
 * Handler to get the combined application settings.
 * @route GET /settings
 */
export async function getSettingsHandler(req, reply) {
    try {
        const settings = await getSettings();
        return reply.send({ data: settings });
    } catch (error) {
        console.error("Error in getSettingsHandler:", error);
        return reply.code(500).send({ error: "An internal server error occurred." });
    }
}

/**
 * Handler to update the application settings.
 * @route PATCH /settings
 */
export async function updateSettingsHandler(req, reply) {
    try {
        const newSettings = req.body;
        if (!newSettings || Object.keys(newSettings).length === 0) {
            return reply.code(400).send({ error: "Request body with settings to update is required." });
        }

        const result = await updateSettings(newSettings);
        return reply.send(result);
    } catch (error) {
        console.error("Error in updateSettingsHandler:", error);
        return reply.code(500).send({ error: error.message });
    }
}


// ===================================================================
// == NEW Game Rates Handlers ==
// ===================================================================

/**
 * Handler to get the combined game rate settings.
 * @route GET /game-rates
 */
export async function getGameRatesHandler(req, reply) {
    try {
        const rates = await getGameRates();
        return reply.send({ data: rates });
    } catch (error) {
        console.error("Error in getGameRatesHandler:", error);
        return reply.code(500).send({ error: "An internal server error occurred." });
    }
}

/**
 * Handler to update the game rate settings.
 * @route PATCH /game-rates
 */
export async function updateGameRatesHandler(req, reply) {
    try {
        const newRates = req.body;
        if (!newRates || Object.keys(newRates).length === 0) {
            return reply.code(400).send({ error: "Request body with rates to update is required." });
        }

        const result = await updateGameRates(newRates);
        return reply.send(result);
    } catch (error) {
        console.error("Error in updateGameRatesHandler:", error);
        return reply.code(500).send({ error: error.message });
    }
}