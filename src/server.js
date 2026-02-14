require("dotenv").config();
const express = require("express");
const { surfQueue } = require("./queue");

const app = express();
app.use(express.json());

app.post("/surf", async (req, res) => {
  const { url } = req.body;

  if (!url || !url.startsWith("http")) {
    return res.status(400).json({ error: "Invalid URL" });
  }

  await surfQueue.add("surfJob", { url });

  res.json({ message: "Job added to queue" });
});

app.listen(3000, () => {
  console.log("Server running on port 3000");
});