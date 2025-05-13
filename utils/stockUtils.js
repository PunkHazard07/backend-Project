const Product = require('../models/Product');

exports.validateStockOnly = async (items) => {
    const stockErrors = [];

    for (const item of items) {
        const product = await Product.findById(item.productId);

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
        stockErrors
    };
};

exports.validateAndUpdateStock = async (items) => {
    const stockErrors = [];
    const updatedItems = [];

    for (const item of items) {
        const product = await Product.findById(item.productId);

        if (!product) {
            stockErrors.push(`Product with ID ${item.productId} not found`);
            continue;
        }

        if (product.isOutOfStock || product.quantity < item.quantity) {
            stockErrors.push(`Insufficient stock for product: ${product.name}`);
            continue;
        }

        product.quantity -= item.quantity;
        if (product.quantity === 0) {
            product.isOutOfStock = true;
        }

        await product.save();
        updatedItems.push(item);
    }

    return {
        isValid: stockErrors.length === 0,
        stockErrors,
        updatedItems
    };
};