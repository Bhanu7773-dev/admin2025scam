import { getAllFunds } from "../services/funds.service.js"

export async function getAllFundRequestsHandler(req, rep) {
    try {
        const { limit, startAfterId } = req.query
        const data = await getAllFunds({limit, startAfterId})

        rep.send({ data })
    } catch (err) {
        rep.status(500).send({ error: err.message })
    }
}