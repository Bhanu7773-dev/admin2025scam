import Fastify from "fastify";
import adminRoutes from "./routes/admin.routes.js";

const app = Fastify({ logger: true })

app.register(adminRoutes, {prefix: '/admin'})

export default app