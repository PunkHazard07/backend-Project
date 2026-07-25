import Product from '../models/Product';

export interface StockItem {
    productId: string;
    quantity: number;
}

export interface StockValidationResult {
    isValid: boolean;
    stockErrors: string[];
}

export interface StockUpdateResult extends StockValidationResult {
    updatedItems: StockItem[];
}

export const validateStockOnly = async (
    items: StockItem[]
): Promise<StockValidationResult> => {
    const stockErrors: string[] = [];

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
        stockErrors,
    };
};

export const validateAndUpdateStock = async (
    items: StockItem[]
): Promise<StockUpdateResult> => {
    const stockErrors: string[] = [];
    const updatedItems: StockItem[] = [];

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
        updatedItems,
    };
};