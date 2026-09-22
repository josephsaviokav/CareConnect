import Fastify from "fastify";
import cors from "@fastify/cors";
import dotenv from "dotenv";
import { patientRoutes } from "./routes/patients.js";
import { inboundRoutes } from "./routes/inbound.js";
import { campaignRoutes } from "./routes/campaigns.js";
import { appointmentRoutes } from "./routes/appointments.js";
import { dripRoutes } from "./routes/drip.js";
import { startDripCron } from "./services/drip-worker.js";

dotenv.config();

const app = Fastify({ logger: true });
await app.register(cors, { origin: true });

await app.register(patientRoutes);
await app.register(inboundRoutes);
await app.register(campaignRoutes);
await app.register(appointmentRoutes);
await app.register(dripRoutes);

startDripCron();

const port = Number(process.env.PORT || 4000);
try {
  await app.listen({ port, host: "0.0.0.0" });
  console.log(`api-server listening on http://localhost:${port}`);
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
