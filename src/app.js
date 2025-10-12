import Fastify from "fastify";
import pointOfView from "@fastify/view";
import fastifyStatic from "@fastify/static";
import cors from "@fastify/cors";
import path from "path";

// Route imports
import adminRoutes from "./routes/admin.routes.js";
import usersRoutes from "./routes/users.routes.js";
import fundsRoutes from "./routes/funds.routes.js";
// import frontendRoutes from "./routes/frontend.routes.js";
// V V V MODIFIED IMPORT V V V
import { settingsRoutes, gameRatesRoutes } from "./routes/settings.routes.js";
import biddingRoutes from "./routes/bidding.routes.js";
import { sendNotificationHandler } from "./controllers/notification.controller.js";
import { verifyFirebaseIdToken } from './plugins/firebaseAuth.js';

const app = Fastify({ logger: false });

// Register the CORS plugin
const allowedOrigins = (process.env.ALLOWED_ORIGINS && process.env.ALLOWED_ORIGINS.split(',')) || ["http://localhost:3000", "http://localhost:4000"];

app.register(cors, {
  origin: allowedOrigins,
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH"],
  credentials: true,
});

app.register(fastifyStatic, {
  root: path.join(process.cwd(), "public"),
  prefix: "/public/",
});

app.register(pointOfView, {
  engine: {
    ejs: import("ejs"),
  },
  root: path.join(process.cwd(), "views"),
  viewExt: "ejs",
});

// --- Route Registration ---

// Frontend routes
// app.register(frontendRoutes, { prefix: "/" });

// API Routes
app.register(adminRoutes, { prefix: "/admin" });
app.register(usersRoutes, { prefix: "/users" });
app.register(fundsRoutes, { prefix: "/funds" });
app.register(biddingRoutes, { prefix: "/biddings" });

// Settings Routes
app.register(settingsRoutes, { prefix: "/settings" });

// V V V NEWLY ADDED ROUTE V V V
app.register(gameRatesRoutes, { prefix: "/game-rates" });

// Protect notify route with Firebase token verification. If you want to allow anonymous broadcasts,
// call the route without a token. Currently this will require a Bearer ID token from Firebase.
app.post('/notify', { preHandler: verifyFirebaseIdToken }, sendNotificationHandler)

export default app;