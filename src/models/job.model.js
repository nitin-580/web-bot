const mongoose = require("mongoose");

const jobSchema = new mongoose.Schema({
    jobId: {
        type: String,
        required: true,
        unique: true,
      },
  productName: String,
  targetASIN: String,


  proxyIP: String,
  proxyCountry: String,
  sessionId: String,

  status: {
    type: String,
    enum: ["waiting", "running", "completed", "failed"],
    default: "waiting",
  },

  error: String,
  rankPosition: Number,
  price: String,

  startedAt: Date,
  finishedAt: Date,
});

module.exports = mongoose.model("Job", jobSchema);