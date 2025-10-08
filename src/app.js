import Fastify from "fastify";
import adminRoutes from "./routes/admin.routes.js";
import usersRoutes from "./routes/users.routes.js";
import fundsRoutes from "./routes/funds.routes.js";

const app = Fastify({ logger: true })

app.register(adminRoutes, {prefix: '/admin'})

app.register(usersRoutes, {prefix: '/users'})

app.register(fundsRoutes, {prefix: '/fund-requests'})

export default app