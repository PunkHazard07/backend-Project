// Mock the Cloudinary SDK at the boundary the wrapper imports from.
// utils/cloudinaryUpload.ts does `import cloudinary from '../config/cloudinary'`
// and then calls `cloudinary.uploader.upload_stream(opts, cb)` and
// `cloudinary.uploader.destroy(publicId)`. We only need to stub those two.
jest.mock('../../config/cloudinary', () => {
    const stream = {
        end: jest.fn(),
        on: jest.fn(),
        once: jest.fn(),
        emit: jest.fn(),
        write: jest.fn(),
    };

    const uploadResult = {
        secure_url: 'https://res.cloudinary.com/test/image/upload/v1/test/sample.jpg',
        public_id: 'test/sample',
    };

    const upload_stream = jest.fn((_opts: unknown, cb: (err: unknown, res: typeof uploadResult) => void) => {
        // Fire the success callback on the next tick so the wrapper's
        // synchronous `stream.end(buffer)` call above this has already happened.
        setImmediate(() => cb(null, uploadResult));
        return stream;
    });

    const destroy = jest.fn().mockResolvedValue({ result: 'ok' });

    // Export under BOTH `module.exports` AND `.default` so that whichever
    // shape TypeScript's CommonJS interop yields (the wrapper imports the
    // default; this file imports the default for its own assertions), both
    // code paths see the same `uploader` object.
    const cloudinaryNS = { uploader: { upload_stream, destroy } };
    return {
        __esModule: true,
        default: cloudinaryNS,
        ...cloudinaryNS,
    };
});

import request from 'supertest';
import app from '../../app';
import Admin from '../../models/Admin';
import Product from '../../models/Product';
import cloudinary from '../../config/cloudinary';
import {
    connectTestDB,
    clearTestDB,
    closeTestDB,
    closeQueueConnections,
} from '../setup';
import { signAccessToken } from '../../utils/jwt';

const upload_stream = cloudinary.uploader.upload_stream as jest.Mock;
const destroy = cloudinary.uploader.destroy as jest.Mock;

// A real 1x1 transparent PNG. multer's fileFilter accepts any image/* mime type.
const PNG_1x1 = Buffer.from(
    '89504E470D0A1A0A0000000D49484452000000010000000108060000001F15C489' +
        '0000000D49444154789C636000010000000500010D0A2DB40000000049454E44AE426082',
    'hex'
);

const validBody = {
    name: 'Walnut Dining Chair',
    description: 'Solid walnut, hand-finished.',
    price: '199.99',
    category: 'Dining Room',
    quantity: '5',
};

const createAdminAndToken = async (): Promise<string> => {
    const admin = await Admin.create({
        email: 'admin@test.com',
        password: 'hashed-not-checked',
    });
    return signAccessToken({ id: admin._id.toString(), role: 'admin' });
};

describe('Product controller (integration)', () => {
    beforeAll(async () => {
        await connectTestDB();
    });

    afterEach(async () => {
        await clearTestDB();
        jest.clearAllMocks();
    });

    afterAll(async () => {
        await closeTestDB();
        await closeQueueConnections();
    });

    // ------------------------------------------------------------------
    // POST /api/add
    // ------------------------------------------------------------------
    describe('POST /api/add', () => {
        it('creates a product with image, stores Cloudinary result, calls upload_stream once', async () => {
            const token = await createAdminAndToken();

            const res = await request(app)
                .post('/api/add')
                .set('Authorization', `Bearer ${token}`)
                .field('name', validBody.name)
                .field('description', validBody.description)
                .field('price', validBody.price)
                .field('category', validBody.category)
                .field('quantity', validBody.quantity)
                .attach('image', PNG_1x1, { filename: 'chair.png', contentType: 'image/png' });

            expect(res.status).toBe(201);
            expect(res.body.product.name).toBe(validBody.name);
            expect(res.body.product.images).toEqual([
                'https://res.cloudinary.com/test/image/upload/v1/test/sample.jpg',
            ]);
            expect(res.body.product.imagePublicId).toBe('test/sample');
            expect(res.body.product.price).toBe(199.99);
            expect(res.body.product.quantity).toBe(5);
            expect(res.body.product.isOutOfStock).toBe(false);

            expect(upload_stream).toHaveBeenCalledTimes(1);
            // folder should be the dev folder (NODE_ENV === 'test')
            const [opts] = upload_stream.mock.calls[0];
            expect(opts).toEqual({ folder: 'dev/product-images' });
        });

        it('creates a product without image, never calls upload_stream', async () => {
            const token = await createAdminAndToken();

            const res = await request(app)
                .post('/api/add')
                .set('Authorization', `Bearer ${token}`)
                .field('name', validBody.name)
                .field('description', validBody.description)
                .field('price', validBody.price)
                .field('category', validBody.category)
                .field('quantity', validBody.quantity);

            expect(res.status).toBe(201);
            expect(res.body.product.images).toEqual([]);
            expect(res.body.product.imagePublicId).toBeUndefined();
            expect(upload_stream).not.toHaveBeenCalled();
        });

        it('rejects a missing field', async () => {
            const token = await createAdminAndToken();
            const { name, ...rest } = validBody;

            const res = await request(app)
                .post('/api/add')
                .set('Authorization', `Bearer ${token}`)
                .field(rest)
                .attach('image', PNG_1x1, { filename: 'chair.png', contentType: 'image/png' });

            expect(res.status).toBe(400);
            expect(res.body.message).toMatch(/all fields are required/i);
        });

        it('rejects a non-numeric price', async () => {
            const token = await createAdminAndToken();

            const res = await request(app)
                .post('/api/add')
                .set('Authorization', `Bearer ${token}`)
                .field({ ...validBody, price: 'cheap' });

            expect(res.status).toBe(400);
            expect(res.body.message).toMatch(/price must be a number/i);
        });

        it('rejects a non-integer or negative quantity', async () => {
            const token = await createAdminAndToken();

            const nonInt = await request(app)
                .post('/api/add')
                .set('Authorization', `Bearer ${token}`)
                .field({ ...validBody, quantity: '3.5' });
            expect(nonInt.status).toBe(400);
            expect(nonInt.body.message).toMatch(/whole number/i);

            const negative = await request(app)
                .post('/api/add')
                .set('Authorization', `Bearer ${token}`)
                .field({ ...validBody, quantity: '-1' });
            expect(negative.status).toBe(400);
            expect(negative.body.message).toMatch(/whole number/i);
        });

        it('rejects an unauthenticated request', async () => {
            const res = await request(app)
                .post('/api/add')
                .field(validBody)
                .attach('image', PNG_1x1, { filename: 'chair.png', contentType: 'image/png' });

            expect(res.status).toBe(401);
        });
    });

    // ------------------------------------------------------------------
    // GET /api/products
    // ------------------------------------------------------------------
    describe('GET /api/products', () => {
        const seed = async () => {
            await Product.create([
                { name: 'A', description: 'a', images: [], price: 10, category: 'Bedroom', quantity: 1 },
                { name: 'B', description: 'b', images: [], price: 30, category: 'Living Room', quantity: 2 },
                { name: 'C', description: 'c', images: [], price: 20, category: 'Bedroom', quantity: 3 },
            ]);
        };

        it('returns all products when no filter is provided', async () => {
            await seed();
            const res = await request(app).get('/api/products');

            expect(res.status).toBe(200);
            expect(res.body.products).toHaveLength(3);
        });

        it('returns an empty array when there are no products', async () => {
            const res = await request(app).get('/api/products');

            expect(res.status).toBe(200);
            expect(res.body.products).toEqual([]);
        });

        it('filters by category', async () => {
            await seed();
            const res = await request(app).get('/api/products').query({ category: 'Bedroom' });

            expect(res.status).toBe(200);
            expect(res.body.products).toHaveLength(2);
            expect(res.body.products.every((p: { category: string }) => p.category === 'Bedroom')).toBe(true);
        });

        it('sorts low-to-high', async () => {
            await seed();
            const res = await request(app).get('/api/products').query({ sort: 'low-high' });

            expect(res.status).toBe(200);
            const prices = res.body.products.map((p: { price: number }) => p.price);
            expect(prices).toEqual([10, 20, 30]);
        });

        it('sorts high-to-low', async () => {
            await seed();
            const res = await request(app).get('/api/products').query({ sort: 'high-low' });

            expect(res.status).toBe(200);
            const prices = res.body.products.map((p: { price: number }) => p.price);
            expect(prices).toEqual([30, 20, 10]);
        });
    });

    // ------------------------------------------------------------------
    // GET /api/single/:id
    // ------------------------------------------------------------------
    describe('GET /api/single/:id', () => {
        it('returns the product for a valid id', async () => {
            const p = await Product.create({
                name: 'A', description: 'a', images: [], price: 1, category: 'Mirror', quantity: 1,
            });
            const res = await request(app).get(`/api/single/${p._id}`);

            expect(res.status).toBe(200);
            expect(res.body.name).toBe('A');
        });

        it('returns 404 for an unknown id', async () => {
            const res = await request(app).get('/api/single/507f1f77bcf86cd799439011');
            expect(res.status).toBe(404);
        });
    });

    // ------------------------------------------------------------------
    // GET /api/latest
    // ------------------------------------------------------------------
    describe('GET /api/latest', () => {
        it('returns at most 8 products, newest first', async () => {
            const now = Date.now();
            const docs = Array.from({ length: 10 }, (_, i) => ({
                name: `P${i}`,
                description: 'd',
                images: [],
                price: i,
                category: 'Bedroom' as const,
                quantity: 1,
                createdAt: new Date(now + i * 1000), 
            }));
            await Product.create(docs);

            const res = await request(app).get('/api/latest');

            expect(res.status).toBe(200);
            expect(res.body.products).toHaveLength(8);

            const prices = res.body.products.map((p: { price: number }) => p.price);
            // Inserted in order P0..P9; newest by createdAt = P9, P8, ..., P2.
            expect(prices).toEqual([9, 8, 7, 6, 5, 4, 3, 2]);
        });

        it('returns an empty array when there are no products', async () => {
            const res = await request(app).get('/api/latest');
            expect(res.status).toBe(200);
            expect(res.body.products).toEqual([]);
        });
    });

    // ------------------------------------------------------------------
    // DELETE /api/remove/:id
    // ------------------------------------------------------------------
    describe('DELETE /api/remove/:id', () => {
        it('removes the product and calls cloudinary destroy with its publicId', async () => {
            const token = await createAdminAndToken();
            const p = await Product.create({
                name: 'A',
                description: 'a',
                images: ['https://example.com/x.jpg'],
                imagePublicId: 'dev/product-images/abc',
                price: 1,
                category: 'Mirror',
                quantity: 1,
            });

            const res = await request(app)
                .delete(`/api/remove/${p._id}`)
                .set('Authorization', `Bearer ${token}`);

            expect(res.status).toBe(200);
            expect(await Product.findById(p._id)).toBeNull();
            expect(destroy).toHaveBeenCalledTimes(1);
            expect(destroy).toHaveBeenCalledWith('dev/product-images/abc');
        });

        it('does not call cloudinary destroy when the product has no imagePublicId', async () => {
            const token = await createAdminAndToken();
            const p = await Product.create({
                name: 'A',
                description: 'a',
                images: [],
                price: 1,
                category: 'Mirror',
                quantity: 1,
            });

            const res = await request(app)
                .delete(`/api/remove/${p._id}`)
                .set('Authorization', `Bearer ${token}`);

            expect(res.status).toBe(200);
            expect(destroy).not.toHaveBeenCalled();
        });

        it('returns 404 for an unknown id', async () => {
            const token = await createAdminAndToken();

            const res = await request(app)
                .delete('/api/remove/507f1f77bcf86cd799439011')
                .set('Authorization', `Bearer ${token}`);

            expect(res.status).toBe(404);
            expect(destroy).not.toHaveBeenCalled();
        });

        it('rejects an unauthenticated request', async () => {
            const p = await Product.create({
                name: 'A', description: 'a', images: [], price: 1, category: 'Mirror', quantity: 1,
            });

            const res = await request(app).delete(`/api/remove/${p._id}`);
            expect(res.status).toBe(401);
        });
    });

    // ------------------------------------------------------------------
    // PUT /api/update/:id
    // ------------------------------------------------------------------
    describe('PUT /api/update/:id', () => {
        it('with a new file: uploads, destroys old, replaces image fields', async () => {
            const token = await createAdminAndToken();
            const p = await Product.create({
                name: 'Old',
                description: 'old',
                images: ['https://example.com/old.jpg'],
                imagePublicId: 'dev/product-images/old',
                price: 50,
                category: 'Bedroom',
                quantity: 2,
            });

            const res = await request(app)
                .put(`/api/update/${p._id}`)
                .set('Authorization', `Bearer ${token}`)
                .field('name', 'New')
                .attach('image', PNG_1x1, { filename: 'new.png', contentType: 'image/png' });

            expect(res.status).toBe(200);
            expect(res.body.product.name).toBe('New');
            expect(res.body.product.images).toEqual([
                'https://res.cloudinary.com/test/image/upload/v1/test/sample.jpg',
            ]);
            expect(res.body.product.imagePublicId).toBe('test/sample');

            expect(upload_stream).toHaveBeenCalledTimes(1);
            expect(destroy).toHaveBeenCalledTimes(1);
            expect(destroy).toHaveBeenCalledWith('dev/product-images/old');
        });

        it('without a file: updates only provided fields and leaves image alone', async () => {
            const token = await createAdminAndToken();
            const p = await Product.create({
                name: 'Old',
                description: 'old',
                images: ['https://example.com/keep.jpg'],
                imagePublicId: 'dev/product-images/keep',
                price: 50,
                category: 'Bedroom',
                quantity: 2,
            });

            const res = await request(app)
                .put(`/api/update/${p._id}`)
                .set('Authorization', `Bearer ${token}`)
                .field('name', 'Renamed')
                .field('price', '75');

            expect(res.status).toBe(200);
            expect(res.body.product.name).toBe('Renamed');
            expect(res.body.product.price).toBe(75);
            expect(res.body.product.images).toEqual(['https://example.com/keep.jpg']);
            expect(res.body.product.imagePublicId).toBe('dev/product-images/keep');
            expect(upload_stream).not.toHaveBeenCalled();
            expect(destroy).not.toHaveBeenCalled();
        });

        it('marks out of stock when quantity drops to 0', async () => {
            const token = await createAdminAndToken();
            const p = await Product.create({
                name: 'A', description: 'a', images: [], price: 1, category: 'Mirror', quantity: 5,
            });

            const res = await request(app)
                .put(`/api/update/${p._id}`)
                .set('Authorization', `Bearer ${token}`)
                .field('quantity', '0');

            expect(res.status).toBe(200);
            expect(res.body.product.quantity).toBe(0);
            expect(res.body.product.isOutOfStock).toBe(true);
        });

        it('rejects a non-integer quantity', async () => {
            const token = await createAdminAndToken();
            const p = await Product.create({
                name: 'A', description: 'a', images: [], price: 1, category: 'Mirror', quantity: 5,
            });

            const res = await request(app)
                .put(`/api/update/${p._id}`)
                .set('Authorization', `Bearer ${token}`)
                .field('quantity', '2.5');

            expect(res.status).toBe(400);
        });

        it('returns 404 for an unknown id', async () => {
            const token = await createAdminAndToken();

            const res = await request(app)
                .put('/api/update/507f1f77bcf86cd799439011')
                .set('Authorization', `Bearer ${token}`)
                .field('name', 'X');

            expect(res.status).toBe(404);
        });

        it('rejects an unauthenticated request', async () => {
            const p = await Product.create({
                name: 'A', description: 'a', images: [], price: 1, category: 'Mirror', quantity: 1,
            });

            const res = await request(app).put(`/api/update/${p._id}`).field('name', 'X');
            expect(res.status).toBe(401);
        });
    });
});
