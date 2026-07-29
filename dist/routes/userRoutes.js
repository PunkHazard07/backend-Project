"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const router = express_1.default.Router();
const { authLimiter, emailLimiter } = require('../middleware/rateLimiter.js'); //to require rate limiter middleware
const controller = __importStar(require("../controllers/userController"));
const auth_1 = require("../middleware/auth");
//creating endpoint for users
router.post('/login', authLimiter, controller.loginUser);
router.post('/register', authLimiter, controller.registerUser);
router.post('/logoutUser', auth_1.auth, auth_1.checkVerified, controller.logoutUser);
router.get('/verify-email', emailLimiter, controller.verifyEmail);
router.post('/resend-verification', emailLimiter, controller.resendVerificationEmail);
router.get("/user/profile", auth_1.auth, auth_1.checkVerified, controller.getUserProfile);
router.post('/forgot-password', emailLimiter, controller.forgotPassword);
router.post('/reset-password', emailLimiter, authLimiter, controller.resetPassword);
router.get('/verify-reset-token', emailLimiter, controller.verifyResetToken);
//exporting the router
exports.default = router;
//# sourceMappingURL=userRoutes.js.map