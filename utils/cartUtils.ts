import type { ICart } from '../models/Cart';

export interface CartItemResponse {
    productId: string;
    name: string;
    image?: string;
    price: number;
    quantity: number;
}

export interface CartResponse {
    items: CartItemResponse[];
    total: number;
}

export const buildCartResponse = async (cart: ICart | null): Promise<CartResponse> => {
    if (!cart || cart.items.length === 0) {
        return { items: [], total: 0 };
    }

    await cart.populate<{ items: { productId: any; quantity: number }[] }>(
        'items.productId',
        'name price images'
    );

    const items: CartItemResponse[] = [];
    let total = 0;

    for (const item of cart.items as any[]) {
        const product = item.productId;

        if (!product || !product._id) continue;

        const price = product.price;

        items.push({
            productId: product._id.toString(),
            name: product.name,
            image: product.images?.[0],
            price,
            quantity: item.quantity,
        });
          total += price * item.quantity;
    }

    return { items, total };
};