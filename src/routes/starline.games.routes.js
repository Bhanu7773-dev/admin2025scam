import { getGames, addGame, updateGame, deleteGame} from "../services/starline.game.service.js"

const gameBodySchema = {
    type: 'object',
    required: ['gameName', 'openTime', 'status'],
    properties: {
        gameName: { type: 'string' },
        gameNameHindi: { type: 'string' },
        openTime: { type: 'string', pattern: '^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$' }, // HH:mm format
        status: { type: 'string', enum: ['0', '1'] },
    },
};

const gameParamsSchema = {
    type: 'object',
    required: ['id'],
    properties: {
        id: { type: 'string', minLength: 1 },
    },
};


/**
 * Encapsulates the routes for the Starline Games API.
 * @param {import('fastify').FastifyInstance} fastify - Fastify instance.
 * @param {object} options - Plugin options.
 */
async function starlineGameController(fastify, options) {
    
    /**
     * Route to get all starline games.
     * GET /games
     */
    fastify.get('/', async (request, reply) => {
        try {
            const games = await getGames();
            reply.send(games);
        } catch (error) {
            request.log.error(error);
            reply.status(500).send({ error: 'Failed to fetch games.' });
        }
    });

    /**
     * Route to add a new starline game.
     * POST /games
     */
    fastify.post('/', { schema: { body: gameBodySchema } }, async (request, reply) => {
        try {
            const gameId = await addGame(request.body);
            reply.status(201).send({ id: gameId, message: 'Game created successfully.' });
        } catch (error) {
            request.log.error(error);
            reply.status(500).send({ error: 'Failed to create game.' });
        }
    });

    /**
     * Route to update an existing starline game.
     * PUT /games/:id
     */
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

    /**
     * Route to delete a starline game.
     * DELETE /games/:id
     */
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
}

export default starlineGameController;