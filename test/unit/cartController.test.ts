import type { Request, Response } from 'express';
import mongoose from 'mongoose';
import {
    getCart,
    addItemToCart,
    removeItemFromCart,
    updateItemQuantity,
    clearCart,
    mergeCart,
} from '../../controllers/cartController';
import Cart from '../../models/Cart';
import Product from '../../models/Product';
import { buildCartResponse } from '../../utils/cartUtils';

jest.mock('../../models/Cart');
jest.mock('../../models/Product');
jest.mock('../../utils/cartUtils');

const mockedCart = Cart as unknown as jest.Mocked<typeof Cart>;
const mockedProduct = Product as unknown as jest.Mocked<typeof Product>;
const mockedBuildCartResponse = buildCartResponse as jest.MockedFunction<typeof buildCartResponse>;

describe('cartController', () => {
    let req: Partial<Request>;
    let res: Partial<Response>;
    let jsonMock: jest.Mock;
    let statusMock: jest.Mock;

    const userId = 'user123';
    const productId = '507f1f77bcf86cd799439011';
    const mockProduct = { _id: productId, name: 'Test Product', price: 99.99 };

    beforeEach(() => {
        jest.clearAllMocks();
        jsonMock = jest.fn();
        statusMock = jest.fn().mockReturnValue({ json: jsonMock });
        res = { status: statusMock, json: jsonMock } as unknown as Response;
        req = { user: { _id: userId } as any };
    });

    describe('getCart', () => {
        it('should return cart items and total for authenticated user', async () => {
            const mockCart = { user: userId, items: [{ productId, quantity: 2 }] };
            mockedCart.findOne.mockResolvedValue(mockCart as any);
            mockedBuildCartResponse.mockResolvedValue({
                items: [{ productId, quantity: 2, name: 'Test Product', price: 99.99 }],
                total: 199.98,
            });

            await getCart(req as Request, res as Response);

            expect(mockedCart.findOne).toHaveBeenCalledWith({ user: userId });
            expect(mockedBuildCartResponse).toHaveBeenCalledWith(mockCart);
            expect(statusMock).toHaveBeenCalledWith(200);
            expect(jsonMock).toHaveBeenCalledWith({
                success: true,
                data: {
                    items: [{ productId, quantity: 2, name: 'Test Product', price: 99.99 }],
                    total: 199.98,
                },
            });
        });

        it('should handle cart being null (no cart yet)', async () => {
            mockedCart.findOne.mockResolvedValue(null);
            mockedBuildCartResponse.mockResolvedValue({ items: [], total: 0 });

            await getCart(req as Request, res as Response);

            expect(mockedBuildCartResponse).toHaveBeenCalledWith(null);
            expect(statusMock).toHaveBeenCalledWith(200);
            expect(jsonMock).toHaveBeenCalledWith({ success: true, data: { items: [], total: 0 } });
        });

        it('should return 500 on database error', async () => {
            mockedCart.findOne.mockRejectedValue(new Error('DB failure'));

            await getCart(req as Request, res as Response);

            expect(statusMock).toHaveBeenCalledWith(500);
            expect(jsonMock).toHaveBeenCalledWith({ success: false, message: 'DB failure' });
        });
    });

    describe('addItemToCart', () => {
        beforeEach(() => {
            req.body = { productId, quantity: 2 };
            mockedProduct.findById.mockResolvedValue(mockProduct as any);
        });

        it('should atomically push a new item into a new-or-existing cart when it is not already present', async () => {
            const newCart = { user: userId, items: [{ productId, quantity: 2 }] };
            mockedCart.findOneAndUpdate
                .mockResolvedValueOnce(null as any) // $inc step misses -- item not in the cart yet
                .mockResolvedValueOnce(newCart as any); // $push + upsert step creates/updates it

            mockedBuildCartResponse.mockResolvedValue({
                items: [{ productId, name: 'Test Product', price: 99.99, quantity: 2 }],
                total: 199.98,
            });

            await addItemToCart(req as Request, res as Response);

            expect(mockedProduct.findById).toHaveBeenCalledWith(productId);
            expect(mockedCart.findOneAndUpdate).toHaveBeenNthCalledWith(
                2,
                { user: userId, 'items.productId': { $ne: productId } },
                { $push: { items: { productId, quantity: 2 } }, $setOnInsert: { user: userId } },
                { new: true, upsert: true, setDefaultsOnInsert: true }
            );
            expect(statusMock).toHaveBeenCalledWith(201);
            expect(jsonMock).toHaveBeenCalledWith({
                success: true,
                message: 'Item added to cart',
                data: {
                    items: [{ productId, name: 'Test Product', price: 99.99, quantity: 2 }],
                    total: 199.98,
                },
            });
        });

        it('should atomically $inc the quantity in a single call for an existing item', async () => {
            const updatedCart = { user: userId, items: [{ productId, quantity: 3 }] };
            mockedCart.findOneAndUpdate.mockResolvedValueOnce(updatedCart as any);

            mockedBuildCartResponse.mockResolvedValue({
                items: [{ productId, name: 'Test Product', price: 99.99, quantity: 3 }],
                total: 299.97,
            });

            await addItemToCart(req as Request, res as Response);

            expect(mockedCart.findOneAndUpdate).toHaveBeenCalledTimes(1);
            expect(mockedCart.findOneAndUpdate).toHaveBeenCalledWith(
                { user: userId, 'items.productId': productId },
                { $inc: { 'items.$.quantity': 2 } },
                { new: true }
            );
            expect(statusMock).toHaveBeenCalledWith(201);
        });

        it('should return 400 if productId is missing', async () => {
            req.body = { quantity: 2 };

            await addItemToCart(req as Request, res as Response);

            expect(statusMock).toHaveBeenCalledWith(400);
            expect(jsonMock).toHaveBeenCalledWith({
                success: false,
                message: 'Invalid productId or quantity',
            });
        });

        it('should return 400 if quantity is missing', async () => {
            req.body = { productId };

            await addItemToCart(req as Request, res as Response);

            expect(statusMock).toHaveBeenCalledWith(400);
        });

        it('should return 400 if quantity is zero', async () => {
            req.body = { productId, quantity: 0 };

            await addItemToCart(req as Request, res as Response);

            expect(statusMock).toHaveBeenCalledWith(400);
        });

        it('should return 400 if quantity is negative', async () => {
            req.body = { productId, quantity: -1 };

            await addItemToCart(req as Request, res as Response);

            expect(statusMock).toHaveBeenCalledWith(400);
        });

        it('should return 400 if quantity is not an integer (e.g. 1.5)', async () => {
            req.body = { productId, quantity: 1.5 };

            await addItemToCart(req as Request, res as Response);

            expect(statusMock).toHaveBeenCalledWith(400);
            expect(jsonMock).toHaveBeenCalledWith({
                success: false,
                message: 'Invalid productId or quantity',
            });
        });

        it('should return 404 if product does not exist', async () => {
            mockedProduct.findById.mockResolvedValue(null);

            await addItemToCart(req as Request, res as Response);

            expect(statusMock).toHaveBeenCalledWith(404);
            expect(jsonMock).toHaveBeenCalledWith({
                success: false,
                message: 'Product not found',
            });
        });

        it('should return 500 on unexpected error', async () => {
            mockedProduct.findById.mockRejectedValue(new Error('DB crashed'));

            await addItemToCart(req as Request, res as Response);

            expect(statusMock).toHaveBeenCalledWith(500);
            expect(jsonMock).toHaveBeenCalledWith({ success: false, message: 'DB crashed' });
        });
    });

    describe('removeItemFromCart', () => {
        beforeEach(() => {
            req.body = { productId };
        });

        it('should remove an item from the cart', async () => {
            const updatedCart = { user: userId, items: [] };
            mockedCart.findOneAndUpdate.mockResolvedValue(updatedCart as any);
            mockedBuildCartResponse.mockResolvedValue({ items: [], total: 0 });

            await removeItemFromCart(req as Request, res as Response);

            expect(mockedCart.findOneAndUpdate).toHaveBeenCalledWith(
                { user: userId, 'items.productId': productId },
                { $pull: { items: { productId } } },
                { new: true }
            );
            expect(statusMock).toHaveBeenCalledWith(200);
            expect(jsonMock).toHaveBeenCalledWith({
                success: true,
                message: 'Item removed from cart',
                data: { items: [], total: 0 },
            });
        });

        it('should return 400 if productId is missing', async () => {
            req.body = {};

            await removeItemFromCart(req as Request, res as Response);

            expect(statusMock).toHaveBeenCalledWith(400);
            expect(jsonMock).toHaveBeenCalledWith({
                success: false,
                message: 'Invalid productId',
            });
        });

        it('should return 404 if item not found in cart', async () => {
            mockedCart.findOneAndUpdate.mockResolvedValue(null);

            await removeItemFromCart(req as Request, res as Response);

            expect(statusMock).toHaveBeenCalledWith(404);
            expect(jsonMock).toHaveBeenCalledWith({
                success: false,
                message: 'Item not found in cart',
            });
        });

        it('should return 500 on database error', async () => {
            mockedCart.findOneAndUpdate.mockRejectedValue(new Error('Update failed'));

            await removeItemFromCart(req as Request, res as Response);

            expect(statusMock).toHaveBeenCalledWith(500);
        });
    });

    describe('updateItemQuantity', () => {
        beforeEach(() => {
            req.body = { productId, delta: 2 };
            jest.spyOn(mongoose, 'isValidObjectId').mockReturnValue(true);
        });

        it('should increase item quantity by delta', async () => {
            const updatedCart = { user: userId, items: [{ productId, quantity: 5 }] };
            mockedCart.findOneAndUpdate.mockResolvedValue(updatedCart as any);
            mockedBuildCartResponse.mockResolvedValue({
                items: [{ productId, name: 'Test Product', price: 99.99, quantity: 5 }],
                total: 499.95,
            });

            await updateItemQuantity(req as Request, res as Response);

            expect(mockedCart.findOneAndUpdate).toHaveBeenCalled();
            expect(statusMock).toHaveBeenCalledWith(200);
            expect(jsonMock).toHaveBeenCalledWith({
                success: true,
                message: 'Cart updated',
                data: expect.any(Object),
            });
        });

        it('should remove item when delta reduces quantity to 0 or below', async () => {
            const updatedCart = { user: userId, items: [] };
            mockedCart.findOneAndUpdate.mockResolvedValue(updatedCart as any);
            mockedBuildCartResponse.mockResolvedValue({ items: [], total: 0 });

            req.body = { productId, delta: -5 };
            await updateItemQuantity(req as Request, res as Response);

            expect(statusMock).toHaveBeenCalledWith(200);
        });

        it('should return 400 if productId is missing', async () => {
            req.body = { delta: 2 };

            await updateItemQuantity(req as Request, res as Response);

            expect(statusMock).toHaveBeenCalledWith(400);
        });

        it('should return 400 if delta is missing', async () => {
            req.body = { productId };

            await updateItemQuantity(req as Request, res as Response);

            expect(statusMock).toHaveBeenCalledWith(400);
        });

        it('should return 400 if delta is not a number', async () => {
            req.body = { productId, delta: 'two' };

            await updateItemQuantity(req as Request, res as Response);

            expect(statusMock).toHaveBeenCalledWith(400);
        });

        it('should return 400 if delta is not an integer', async () => {
            req.body = { productId, delta: 1.5 };

            await updateItemQuantity(req as Request, res as Response);

            expect(statusMock).toHaveBeenCalledWith(400);
        });

        it('should return 400 if delta is zero', async () => {
            req.body = { productId, delta: 0 };

            await updateItemQuantity(req as Request, res as Response);

            expect(statusMock).toHaveBeenCalledWith(400);
        });

        it('should return 400 if productId is not a valid ObjectId', async () => {
            jest.spyOn(mongoose, 'isValidObjectId').mockReturnValue(false);
            req.body = { productId: 'invalid-id', delta: 2 };

            await updateItemQuantity(req as Request, res as Response);

            expect(statusMock).toHaveBeenCalledWith(400);
            expect(jsonMock).toHaveBeenCalledWith({
                success: false,
                message: 'Invalid productId',
            });
        });

        it('should return 404 if item not found in cart', async () => {
            mockedCart.findOneAndUpdate.mockResolvedValue(null);

            await updateItemQuantity(req as Request, res as Response);

            expect(statusMock).toHaveBeenCalledWith(404);
            expect(jsonMock).toHaveBeenCalledWith({
                success: false,
                message: 'Item not found in cart',
            });
        });

        it('should return 500 on database error', async () => {
            mockedCart.findOneAndUpdate.mockRejectedValue(new Error('Update error'));

            await updateItemQuantity(req as Request, res as Response);

            expect(statusMock).toHaveBeenCalledWith(500);
        });
    });

    describe('mergeCart', () => {
        beforeEach(() => {
            req.body = {
                items: [
                    { productId, quantity: 2 },
                    { productId: '507f1f77bcf86cd799439022', quantity: 1 },
                ],
            };
        (mockedProduct.findById.mockImplementation as any)((id: string) => {
            if (id === productId) return Promise.resolve(mockProduct as any);
            return Promise.resolve({ _id: id, name: 'Another Product', price: 10 } as any);
            });
        });

        it('should merge local items into user cart', async () => {
            const mockCart = { user: userId, items: [{ productId, quantity: 4 }] };
            mockedCart.findOneAndUpdate.mockResolvedValue(mockCart as any);
            mockedCart.findOne.mockResolvedValue(mockCart as any);
            mockedBuildCartResponse.mockResolvedValue({
                items: [{ productId, name: 'Test Product', price: 99.99, quantity: 4 }],
                total: 396,
            });

            await mergeCart(req as Request, res as Response);

            expect(statusMock).toHaveBeenCalledWith(200);
            expect(jsonMock).toHaveBeenCalledWith({
                success: true,
                message: 'Cart merged successfully',
                data: expect.any(Object),
            });
        });

        it('should return 400 if items array is empty', async () => {
            req.body = { items: [] };

            await mergeCart(req as Request, res as Response);

            expect(statusMock).toHaveBeenCalledWith(400);
            expect(jsonMock).toHaveBeenCalledWith({
                success: false,
                message: 'No items to merge',
            });
        });

        it('should return 400 if items is missing', async () => {
            req.body = {};

            await mergeCart(req as Request, res as Response);

            expect(statusMock).toHaveBeenCalledWith(400);
        });

        it('should skip invalid items (missing productId or quantity)', async () => {
            req.body = {
                items: [
                    { productId, quantity: 2 },
                    { productId: '', quantity: 1 },
                    { productId: '507f1f77bcf86cd799439022', quantity: 0 },
                ],
            };
            const mockCart = { user: userId, items: [{ productId, quantity: 2 }] };
            mockedCart.findOneAndUpdate.mockResolvedValue(mockCart as any);
            mockedCart.findOne.mockResolvedValue(mockCart as any);
            mockedBuildCartResponse.mockResolvedValue({
                items: [{ productId, name: 'Test Product', price: 99.99, quantity: 2 }],
                total: 199.98,
            });

            await mergeCart(req as Request, res as Response);

            expect(statusMock).toHaveBeenCalledWith(200);
        });

        it('should skip items with non-integer quantity', async () => {
            req.body = {
                items: [
                    { productId, quantity: 2 },
                    { productId: '507f1f77bcf86cd799439022', quantity: 1.5 },
                ],
            };
            const mockCart = { user: userId, items: [{ productId, quantity: 2 }] };
            mockedCart.findOneAndUpdate.mockResolvedValue(mockCart as any);
            mockedCart.findOne.mockResolvedValue(mockCart as any);
            mockedBuildCartResponse.mockResolvedValue({
                items: [{ productId, name: 'Test Product', price: 99.99, quantity: 2 }],
                total: 199.98,
            });

            await mergeCart(req as Request, res as Response);

            expect(statusMock).toHaveBeenCalledWith(200);
        });

        it('should skip items whose product does not exist', async () => {
            mockedProduct.findById.mockResolvedValue(null);
            const mockCart = { user: userId, items: [] };
            mockedCart.findOne.mockResolvedValue(mockCart as any);
            mockedBuildCartResponse.mockResolvedValue({ items: [], total: 0 });

            await mergeCart(req as Request, res as Response);

            expect(statusMock).toHaveBeenCalledWith(200);
            expect(jsonMock).toHaveBeenCalledWith({
                success: true,
                message: 'Cart merged successfully',
                data: { items: [], total: 0 },
            });
        });

        it('should fetch existing cart if all merge items were invalid', async () => {
            req.body = { items: [{ productId: 'bad', quantity: 0 }] };
            const existingCart = { user: userId, items: [{ productId, quantity: 1 }] };
            mockedCart.findOne.mockResolvedValue(existingCart as any);
            mockedBuildCartResponse.mockResolvedValue({
                items: [{ productId, name: 'Test Product', price: 99.99, quantity: 1 }],
                total: 99.99,
            });

            await mergeCart(req as Request, res as Response);

            expect(mockedCart.findOne).toHaveBeenCalledWith({ user: userId });
            expect(statusMock).toHaveBeenCalledWith(200);
        });

        it('should return 500 on unexpected error', async () => {
            mockedProduct.findById.mockRejectedValue(new Error('DB down'));

            await mergeCart(req as Request, res as Response);

            expect(statusMock).toHaveBeenCalledWith(500);
            expect(jsonMock).toHaveBeenCalledWith({ success: false, message: 'DB down' });
        });
    });
});