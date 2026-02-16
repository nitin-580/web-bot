const mongoose = require("mongoose");

const jobSchema = new mongoose.Schema({
  jobId: String,
  productName: String,
  targetASIN: String,

  proxyIP: String,
  proxyCountry: String,
  sessionId: String,

  status: {
    type: String,
    enum: ["running", "completed", "failed"],
  },

  error: String,
  rankPosition: Number,
  price: String,

  startedAt: Date,
  finishedAt: Date,
});

module.exports = mongoose.model("Job", jobSchema);