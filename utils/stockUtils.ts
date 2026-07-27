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

export interface PricedItem extends StockItem {
    price: number;
    name: string;
}

export interface PriceValidationResult extends StockValidationResult {
    pricedItems: PricedItem[];
    amount: number;
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

export const validateAndPriceItems = async (
    items: StockItem[]
): Promise<PriceValidationResult> => {
    const stockErrors: string[] = [];
    const pricedItems: PricedItem[] = [];
    let amount = 0;

    for (const item of items) {
        if (!item.productId || !item.quantity || item.quantity < 1) {
            stockErrors.push(`Invalid item: ${JSON.stringify(item)}`);
            continue;
        }

        const product = await Product.findById(item.productId);

        if (!product) {
            stockErrors.push(`Product with ID ${item.productId} not found`);
            continue;
        }

        if (product.isOutOfStock || product.quantity < item.quantity) {
            stockErrors.push(`Insufficient stock for product: ${product.name}`);
            continue;
        }

        pricedItems.push({
            productId: item.productId,
            quantity: item.quantity,
            price: product.price,
            name: product.name,
        });
        amount += product.price * item.quantity;
    }

    return {
        isValid: stockErrors.length === 0,
        stockErrors,
        pricedItems,
        amount,
    };
};