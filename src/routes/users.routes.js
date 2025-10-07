import { getAllUsersHandler, getUserFundsHandler, getUserHandler } from "../controllers/users.controller.js"
import { getFundsOfUser } from "../services/funds.service.js"

export default function usersRoutes(fastify) {
  fastify.get("/", getAllUsersHandler)
  fastify.get("/:uuid", getUserHandler)

  fastify.get("/:uuid/funds", getUserFundsHandler)
}
