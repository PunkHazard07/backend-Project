import { buildCartResponse } from '../../utils/cartUtils';

describe('buildCartResponse', () => {
    it('should return an empty cart when given null', async () => {
        const result = await buildCartResponse(null);
        expect(result).toEqual({ items: [], total: 0 });
    });

    it('should return an empty cart without populating when the cart has no items', async () => {
        const cart = { items: [], populate: jest.fn() } as any;

        const result = await buildCartResponse(cart);

        expect(result).toEqual({ items: [], total: 0 });
        expect(cart.populate).not.toHaveBeenCalled();
    });

    it('should populate items and compute the total from live product prices', async () => {
        const cart = {
            items: [
                { productId: { _id: 'prod_1', name: 'Chair', price: 100, images: ['chair.jpg'] }, quantity: 2 },
                { productId: { _id: 'prod_2', name: 'Table', price: 50, images: [] }, quantity: 1 },
            ],
            populate: jest.fn().mockResolvedValue(undefined),
        } as any;

        const result = await buildCartResponse(cart);

        expect(cart.populate).toHaveBeenCalledWith('items.productId', 'name price images');
        expect(result.total).toBe(250); // (100 * 2) + (50 * 1)
        expect(result.items).toEqual([
            { productId: 'prod_1', name: 'Chair', image: 'chair.jpg', price: 100, quantity: 2 },
            { productId: 'prod_2', name: 'Table', image: undefined, price: 50, quantity: 1 },
        ]);
    });

    it('should skip line items whose product no longer exists', async () => {
        const cart = {
            items: [
                { productId: null, quantity: 1 }, // product was deleted after being added to the cart
                { productId: { _id: 'prod_1', name: 'Chair', price: 100, images: [] }, quantity: 1 },
            ],
            populate: jest.fn().mockResolvedValue(undefined),
        } as any;

        const result = await buildCartResponse(cart);

        expect(result.items).toHaveLength(1);
        expect(result.items[0].productId).toBe('prod_1');
        expect(result.total).toBe(100);
    });
});