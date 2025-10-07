import { getFundsOfUser } from "../services/funds.service.js"
import { getAllUsers, getUser } from "../services/users.service.js"

export async function getUserHandler(req, rep) {
  try {
    const { uuid } = req.params
    if (!uuid) return rep.status(400).send({ error: "uuid is required" })

    const user = await getUser({ uuid })

    if (!user) return rep.status(404).send({ error: "User not found" })

    rep.send({ data: user })
  } catch (err) {
    rep.status(500).send({ error: err.message })
  }
}

export async function getAllUsersHandler(req, rep) {
  try {
    const { limit, startAfterId, includeAdmins } = req.query

    const { users, nextCursor } = await getAllUsers({
      limit: Number(limit) || 20,
      startAfterId: startAfterId || null,
      includeAdmins: includeAdmins === "true"
    })

    rep.send({
      data: users,
      nextCursor
    })
  } catch (err) {
    rep.status(500).send({ error: err instanceof Error ? err.message : "Unknown error" })
  }
}

export async function getUserFundsHandler(req, rep) {
  try {
    const { uuid } = req.params
    if (!uuid) return rep.status(400).send({ error: "uuid is required" })

    const funds = await getFundsOfUser({ uuid })

    rep.send({ data: funds })
  } catch (err) {
    rep.status(500).send({ error: err instanceof Error ? err.message : "Unknown error" })
  }
}
