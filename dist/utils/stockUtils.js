"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateAndUpdateStock = exports.validateStockOnly = void 0;
const Product_1 = __importDefault(require("../models/Product"));
const validateStockOnly = async (items) => {
    const stockErrors = [];
    for (const item of items) {
        const product = await Product_1.default.findById(item.productId);
        if (!product) {
            stockErrors.push(`Product with ID ${item.productId} not found`);
            continue;
        }
        if (product.isOutOfStock || product.quantity < item.quantity) {
            stockErrors.push(`Insufficient stock for product: ${product.name}`);
        }
    }
    return {
        isValid: stockErrors.length === 0,
        stockErrors,
    };
};
exports.validateStockOnly = validateStockOnly;
const validateAndUpdateStock = async (items) => {
    const stockErrors = [];
    const updatedItems = [];
    for (const item of items) {
        const product = await Product_1.default.findOneAndUpdate({ _id: item.productId, quantity: { $gte: item.quantity } }, { $inc: { quantity: -item.quantity } }, { new: true });
        if (!product) {
            const existing = await Product_1.default.findById(item.productId);
            stockErrors.push(existing
                ? `Insufficient stock for product: ${existing.name}`
                : `Product with ID ${item.productId} not found`);
            continue;
        }
        if (product.quantity === 0 && !product.isOutOfStock) {
            product.isOutOfStock = true;
            await product.save();
        }
        updatedItems.push(item);
    }
    if (stockErrors.length > 0) {
        for (const item of updatedItems) {
            const restored = await Product_1.default.findByIdAndUpdate(item.productId, { $inc: { quantity: item.quantity } }, { new: true });
            if (restored && restored.isOutOfStock && restored.quantity > 0) {
                restored.isOutOfStock = false;
                await restored.save();
            }
        }
        return { isValid: false, stockErrors, updatedItems: [] };
    }
    return { isValid: true, stockErrors, updatedItems };
};
exports.validateAndUpdateStock = validateAndUpdateStock;
// TODO(transactions): validateAndUpdateStock decrements stock per-item and
// rolls back on failure, but the rollback itself isn't atomic — a crash
// between decrementing item N and rolling back items 1..N-1 would leave a
// stuck partial decrement with no automatic recovery.
// Proper fix: wrap the whole decrement+rollback flow in a Mongo session
// (mongoose.startSession() + session.withTransaction()), passing { session }
// through every findOneAndUpdate/save call in this function.
// Requires MongoDB to be running as a replica set (or Atlas, which is a
// replica set by default) — standalone mongod does not support transactions.
// Verify deployment topology before implementing.
// Until then: this is a known, accepted gap — low probability (requires a
// crash in a narrow window) but worth fixing before this sees high order volume.
//# sourceMappingURL=stockUtils.js.map