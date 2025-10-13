import * as gameService from "../services/game.service.js";

/**
 * Handler to get all game documents.
 * @route GET /games
 */
export async function getAllGamesHandler(req, reply) {
    try {
        const games = await gameService.getAllGames();
        return reply.send({ data: games });
    } catch (error) {
        console.error("Error in getAllGamesHandler:", error);
        return reply.code(500).send({ error: "An internal server error occurred." });
    }
}

/**
 * Handler to add a new game from the master list to the database.
 * @route POST /games
 */
export async function addGameHandler(req, reply) {
    try {
        const { id, name } = req.body;
        if (!id || !name) {
            return reply.code(400).send({ error: "Game 'id' and 'name' are required." });
        }
        const newGame = await gameService.addGame({ id, name });
        return reply.code(201).send({ data: newGame });
    } catch (error) {
        console.error("Error in addGameHandler:", error);
        return reply.code(500).send({ error: error.message });
    }
}

/**
 * Handler to update a game's details (altName, isDisabled).
 * @route PATCH /games/:id
 */
export async function updateGameHandler(req, reply) {
    try {
        const { id } = req.params;
        const updateData = req.body;
        if (!updateData || Object.keys(updateData).length === 0) {
            return reply.code(400).send({ error: "Request body must contain fields to update." });
        }
        const result = await gameService.updateGame({ id, data: updateData });
        return reply.send(result);
    } catch (error) {
        console.error(`Error in updateGameHandler for id ${req.params.id}:`, error);
        return reply.code(500).send({ error: error.message });
    }
}

/**
 * Handler to delete a game.
 * @route DELETE /games/:id
 */
export async function deleteGameHandler(req, reply) {
    try {
        const { id } = req.params;
        const result = await gameService.deleteGame({ id });
        return reply.send(result);
    } catch (error) {
        console.error(`Error in deleteGameHandler for id ${req.params.id}:`, error);
        return reply.code(500).send({ error: error.message });
    }
}