"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
const multer_1 = __importDefault(require("multer"));
const storage = multer_1.default.memoryStorage();
// Only allow image uploads
const fileFilter = (req, file, callback) => {
    if (file.mimetype.startsWith('image/')) {
        callback(null, true);
    }
    else {
        callback(new Error('Only image files are allowed'));
    }
};
// Upload middleware
const upload = (0, multer_1.default)({
    storage,
    fileFilter,
    limits: {
        fileSize: 5 * 1024 * 1024,
    },
});
module.exports = upload;
//# sourceMappingURL=multer.js.map