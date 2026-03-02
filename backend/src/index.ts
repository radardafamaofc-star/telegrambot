import express from "express";
import cors from "cors";
import { registerRoutes } from "./routes.js";

const app = express();

// Allow requests from any origin (Lovable preview + published URL)
app.use(cors({ origin: true }));
app.use(express.json());

// Health check
app.get("/health", (_req, res) => res.json({ status: "ok" }));

registerRoutes(app);

const PORT = parseInt(process.env.PORT || "3000", 10);
app.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 TeleTransfer backend running on port ${PORT}`);
});
