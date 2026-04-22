const express = require("express");
const cors = require("cors");
const env = require("./config/env");
const authRoutes = require("./routes/auth");
const healthRoutes = require("./routes/health");
const dataRoutes = require("./routes/data");

const app = express();
const port = env.port || 5000;

app.use(cors());
app.use(express.json());

app.use("/api/auth", authRoutes);
app.use("/api/health", healthRoutes);
app.use("/api/data", dataRoutes);

app.get("/", (_req, res) => {
  res.json({
    status: "ok",
    message: "Chuka backend API is running",
    apiUrl: env.apiUrl,
  });
});

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({
    status: "error",
    message: "Internal server error",
  });
});

app.listen(port, () => {
  console.log(`Backend server running on port ${port}`);
});
