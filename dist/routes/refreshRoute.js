"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const router = express_1.default.Router();
const refreshController_1 = require("../controllers/refreshController");
// Create a POST endpoint for refreshing tokens
router.post('/refresh-token', refreshController_1.refreshToken);
// Export the router
exports.default = router;
//# sourceMappingURL=refreshRoute.js.map