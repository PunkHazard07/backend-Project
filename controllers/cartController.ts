import type { Request, Response } from 'express';
import mongoose from 'mongoose';
import Cart, { type ICart } from '../models/Cart';
import Product from '../models/Product';
import { buildCartResponse } from '../utils/cartUtils';

async function incrementOrCreateItem(
    userId: string,
    productId: string,
    quantity: number,
    attempt = 0
): Promise<ICart> {
    const incremented = await Cart.findOneAndUpdate(
        { user: userId, 'items.productId': productId },
        { $inc: { 'items.$.quantity': quantity } },
        { new: true }
    );
    if (incremented) return incremented;

    try {
        const created = await Cart.findOneAndUpdate(
            { user: userId, 'items.productId': { $ne: productId } },
            { $push: { items: { productId, quantity } }, $setOnInsert: { user: userId } },
            { new: true, upsert: true, setDefaultsOnInsert: true }
        );
        return created!;
    } catch (error: any) {
        if (error?.code === 11000 && attempt < 3) {
            return incrementOrCreateItem(userId, productId, quantity, attempt + 1);
        }
        throw error;
    }
}

//get authenticated user's cart, price live from product data
export const getCart = async (req: Request, res: Response) => {
    try {
        const userId = req.user!._id;

        const cart = await Cart.findOne({ user: userId });
        const { items, total } = await buildCartResponse(cart);

        res.status(200).json({ success: true, data: { items, total } });
    } catch (error: any) {
        console.error('Error fetching cart:', error.message);
        res.status(500).json({ success: false, message: error.message });
    }
};

// Add item to cart/increase its quantity if it's already there
export const addItemToCart = async (req: Request, res: Response) => {
    try {
        const userId = req.user!._id;
        const { productId, quantity } = req.body as { productId?: string; quantity?: number };

        if (!productId || !quantity || !Number.isInteger(quantity) || quantity <= 0) {
            return res.status(400).json({ success: false, message: 'Invalid productId or quantity' });
        }

        const product = await Product.findById(productId);
        if (!product) {
            return res.status(404).json({ success: false, message: 'Product not found' });
        }

        const cart = await incrementOrCreateItem(userId.toString(), productId, quantity);

        const { items, total } = await buildCartResponse(cart);

        res.status(201).json({
            success: true,
            message: 'Item added to cart',
            data: { items, total },
        });
    } catch (error: any) {
        console.error('Error in addItemToCart:', error.message);
        res.status(500).json({ success: false, message: error.message });
    }
};

//remove an item from the cart entirely 
export const removeItemFromCart = async (req: Request, res: Response) => {
    try {
        const userId = req.user!._id;
        const { productId } = req.body as { productId?: string };

        if (!productId) {
            return res.status(400).json({ success: false, message: 'Invalid productId' });
        }

        const cart = await Cart.findOneAndUpdate(
            { user: userId, 'items.productId': productId },
            { $pull: { items: { productId } } },
            { new: true }
        );

        if (!cart) {
            return res.status(404).json({ success: false, message: 'Item not found in cart' });
        }

        const { items, total } = await buildCartResponse(cart);

        res.status(200).json({
            success: true,
            message: 'Item removed from cart',
            data: { items, total },
        });
    } catch (error: any) {
        console.error('Error removing item from cart:', error.message);
        res.status(500).json({ success: false, message: error.message });
    }
};

//update quantity delta based quantity 
export const updateItemQuantity = async (req: Request, res: Response) => {
    try {
        const userId = req.user!._id;
        const { productId, delta } = req.body as { productId?: string; delta?: number };

        if (!productId || typeof delta !== 'number' || !Number.isInteger(delta) || delta === 0) {
            return res.status(400).json({ success: false, message: 'Invalid productId or delta' });
        }

        if (!mongoose.isValidObjectId(productId)) {
            return res.status(400).json({ success: false, message: 'Invalid productId' });
        }

        const productObjectId = new mongoose.Types.ObjectId(productId);

        const cart = await Cart.findOneAndUpdate(
            { user: userId, 'items.productId': productId },
            [
                {
                    $set: {
                        items: {
                            $map: {
                                input: '$items',
                                as: 'item',
                                in: {
                                    $cond: [
                                        { $eq: ['$$item.productId', productObjectId] },
                                        {
                                            productId: '$$item.productId',
                                            quantity: { $add: ['$$item.quantity', delta] },
                                        },
                                        '$$item',
                                    ],
                                },
                            },
                        },
                    },
                },
                {
                    $set: {
                        items: {
                            $filter: {
                                input: '$items',
                                as: 'item',
                                cond: { $gt: ['$$item.quantity', 0] },
                            },
                        },
                    },
                },
            ],
            { new: true }
        );

        if (!cart) {
            return res.status(404).json({ success: false, message: 'Item not found in cart' });
        }

        const { items, total } = await buildCartResponse(cart);

        res.status(200).json({
            success: true,
            message: 'Cart updated',
            data: { items, total },
        });
    } catch (error: any) {
        console.error('Error updating item quantity:', error.message);
        res.status(500).json({ success: false, message: error.message });
    }
};

// Clear cart
export const clearCart = async (req: Request, res: Response) => {
    try {
        const userId = req.user!._id;

        const cart = await Cart.findOneAndUpdate(
            { user: userId },
            { items: [] },
            { new: true }
        );

        if (!cart) {
            return res.status(404).json({ success: false, message: 'Cart not found' });
        }

        res.status(200).json({
            success: true,
            message: 'Cart cleared',
            data: { items: [], total: 0 },
        });
    } catch (error: any) {
        console.error('Error clearing cart:', error.message);
        res.status(500).json({ success: false, message: error.message });
    }
};

//merge cart
export const mergeCart = async (req: Request, res: Response) => {
    try {
        const userId = req.user!._id;
        const { items } = req.body as { items?: { productId: string; quantity: number }[] };

        if (!items || items.length === 0) {
            return res.status(400).json({ success: false, message: 'No items to merge' });
        }

        let cart: ICart | null = null;

        for (const localItem of items) {
            const { productId, quantity } = localItem;

            if (!productId || !quantity || !Number.isInteger(quantity) || quantity <= 0) {
                console.warn('Skipping invalid merge item:', localItem);
                continue;
            }

            const product = await Product.findById(productId);
            if (!product) {
                console.warn(`Product ${productId} not found during merge, skipping`);
                continue;
            }

            cart = await incrementOrCreateItem(userId.toString(), productId, quantity);
        }

        if (!cart) {
            // Every incoming item was invalid or referenced a missing product --
            // reflect whatever the user's cart already looked like, if anything.
            cart = await Cart.findOne({ user: userId });
        }

        const { items: mergedItems, total } = await buildCartResponse(cart);

        res.status(200).json({
            success: true,
            message: 'Cart merged successfully',
            data: { items: mergedItems, total },
        });
    } catch (error: any) {
        console.error('Error merging cart:', error.message);
        res.status(500).json({ success: false, message: error.message });
    }
};