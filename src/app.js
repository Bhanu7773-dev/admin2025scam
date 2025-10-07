import Fastify from "fastify";
import adminRoutes from "./routes/admin.routes.js";
import usersRoutes from "./routes/users.routes.js";

const app = Fastify({ logger: true })

app.register(adminRoutes, {prefix: '/admin'})

app.register(usersRoutes, {prefix: '/users'})

export default app