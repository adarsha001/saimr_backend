// models/Counter.js
const mongoose = require('mongoose');

const counterSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true
  },
  seq: {
    type: Number,
    default: 100000 // Start from 100000 so first agent gets cleartitle100001
  }
});

module.exports = mongoose.model('Counter', counterSchema);