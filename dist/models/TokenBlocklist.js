"use strict";
const mongoose = require('mongoose');
const tokenBlocklistSchema = new mongoose.Schema({
    token: { type: String, required: true },
    expiresAt: { type: Date, required: true }, // Expiration time
});
module.exports = mongoose.model('TokenBlocklist', tokenBlocklistSchema);
//# sourceMappingURL=TokenBlocklist.js.map