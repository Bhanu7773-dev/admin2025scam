// controllers/game.handler.js
import * as gameService from "../services/games.service.js";

export const getAllGamesHandler = async (req, reply) => reply.send({ data: await gameService.getAllGames() });
export const addGameHandler = async (req, reply) => reply.code(201).send({ data: await gameService.addGame(req.body) });
export const updateGameHandler = async (req, reply) => reply.send(await gameService.updateGame({ id: req.params.id, data: req.body }));
export const deleteGameHandler = async (req, reply) => reply.send(await gameService.deleteGame({ id: req.params.id }));

// routes/gameRoutes.js
// import { getAllGamesHandler, addGameHandler, updateGameHandler, deleteGameHandler } from "../controllers/games.controller.js";

export default async function gamesRoutes(fastify) {
    fastify.get("/", getAllGamesHandler);
    fastify.post("/", addGameHandler);
    fastify.patch("/:id", updateGameHandler);
    fastify.delete("/:id", deleteGameHandler);
}