import { getGames, addGame, updateGame, deleteGame } from "../services/starline.game.service.js";
import { declareStarlineResultHandler, getStarlineResultsHandler, predictStarlineWinnersHandler } from "../controllers/starline.settings.controller.js";

const gameBodySchema = {
    type: 'object',
    required: ['game_name', 'close_time', 'game_status'],
    properties: {
        game_name: { type: 'string' },
        game_name_hindi: { type: 'string' },
        close_time: { type: 'string', pattern: '^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$' }, // HH:mm format
        game_status: { type: 'string', enum: ['0', '1'] },
    },
};

const gameParamsSchema = {
    type: 'object',
    required: ['id'],
    properties: {
        id: { type: 'string', minLength: 1 },
    },
};

async function starlineGameController(fastify, options) {
    
    // --- Game Management Routes ---

    fastify.get('/', async (request, reply) => {
        try {
            const games = await getGames();
            reply.send({ data: games });
        } catch (error) {
            request.log.error(error);
            reply.status(500).send({ error: 'Failed to fetch games.' });
        }
    });

    fastify.post('/', { schema: { body: gameBodySchema } }, async (request, reply) => {
        try {
            const gameId = await addGame(request.body);
            reply.status(201).send({ id: gameId, message: 'Game created successfully.' });
        } catch (error) {
            request.log.error(error);
            reply.status(500).send({ error: 'Failed to create game.' });
        }
    });

    fastify.put('/:id', { schema: { body: gameBodySchema, params: gameParamsSchema } }, async (request, reply) => {
        try {
            const { id } = request.params;
            const updatedData = request.body;
            await updateGame(id, updatedData);
            reply.send({ id, message: 'Game updated successfully.' });
        } catch (error) {
            request.log.error(error);
            reply.status(500).send({ error: 'Failed to update game.' });
        }
    });

    fastify.delete('/:id', { schema: { params: gameParamsSchema } }, async (request, reply) => {
        try {
            const { id } = request.params;
            await deleteGame(id);
            reply.send({ id, message: 'Game deleted successfully.' });
        } catch (error) {
            request.log.error(error);
            reply.status(500).send({ error: 'Failed to delete game.' });
        }
    });

    // --- Starline Result Routes ---

    fastify.post('/results/declare', declareStarlineResultHandler);

    fastify.get('/results', getStarlineResultsHandler);

    /**
     * Route to predict winners for a starline game result without saving.
     * POST /starline-games/results/predict
     */
    fastify.post('/results/predict', predictStarlineWinnersHandler);
}

export default starlineGameController;