import express from "express";
import cors from "cors";
import config from "../config.json";
import meetingRoutes from "./routes/meeting.routes";
import webhookRoutes from "./routes/webhook.routes";

const app = express();

app.use(cors({ origin: "*" }));
app.use(express.json());

app.use("/v1/meeting", meetingRoutes);
app.use("/v1/webhook", webhookRoutes);

app.get("/health", (_req, res) => res.json({ status: "ok" }));

const PORT = config.port || 4000;
app.listen(PORT, () => {
  console.log(`classplus-backend running on port ${PORT}`);
});

export default app;
