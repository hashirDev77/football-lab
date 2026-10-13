import Fastify from "fastify";
import cors from "@fastify/cors";
import { config } from "./config.js";
import { registerAppRoutes } from "./routes/app.js";
import { registerAdminRoutes } from "./routes/admin.js";

const app = Fastify({ logger: true });
await app.register(cors, { origin: true });
await registerAppRoutes(app);
await registerAdminRoutes(app);

app.setErrorHandler((error, _req, reply) => {
  app.log.error(error);
  reply.code(500).send({ error: "This information could not be loaded." });
});

app.get("/health", async () => ({
  ok: true,
  sport: "football",
  hasApiKey: Boolean(config.apiKey),
  hasLiveKey: Boolean(config.liveKey),
}));

app.listen({ port: config.port, host: "127.0.0.1" }).catch((err) => {
  app.log.error(err);
  process.exit(1);
});
