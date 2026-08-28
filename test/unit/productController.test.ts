import type { Request, Response } from 'express';
import {
    addProduct,
    listProducts,
    removeProduct,
    singleProduct,
    updateProduct,
    latestProducts,
} from '../../controllers/productController';
import Product from '../../models/Product';
import { uploadImageBuffer, deleteImageIfExists } from '../../utils/cloudinaryUpload';

jest.mock('../../models/Product');
jest.mock('../../utils/cloudinaryUpload');

const mockedProduct = Product as unknown as jest.Mocked<typeof Product>;
const mockedUploadImageBuffer = uploadImageBuffer as jest.MockedFunction<typeof uploadImageBuffer>;
const mockedDeleteImageIfExists = deleteImageIfExists as jest.MockedFunction<typeof deleteImageIfExists>;

describe('productController', () => {
    let req: Partial<Request>;
    let res: Partial<Response>;
    let jsonMock: jest.Mock;
    let statusMock: jest.Mock;

    const productId = '507f1f77bcf86cd799439011';

    beforeEach(() => {
        jest.clearAllMocks();
        jsonMock = jest.fn();
        statusMock = jest.fn().mockReturnValue({ json: jsonMock });
        res = { status: statusMock, json: jsonMock } as unknown as Response;
        req = { body: {}, params: {}, query: {} };
    });

    
    describe('addProduct', () => {
        const validBody = {
            name: 'Test Chair',
            description: 'A comfortable chair',
            price: '199.99',
            category: 'Chairs',
            quantity: '5',
        };

        beforeEach(() => {
            req.body = { ...validBody };
        });

        it('returns 400 when a required field is missing', async () => {
            req.body = { ...validBody, name: undefined };

            await addProduct(req as Request, res as Response);

            expect(statusMock).toHaveBeenCalledWith(400);
            expect(jsonMock).toHaveBeenCalledWith({ message: 'All fields are required' });
        });

        it('treats quantity 0 as provided, not missing (uses === undefined, not falsy check)', async () => {
            req.body = { ...validBody, quantity: '0' };
            const saveMock = jest.fn().mockResolvedValue({ _id: productId, ...validBody, quantity: 0 });
            (mockedProduct as any).mockImplementation(function (this: any, data: any) {
                Object.assign(this, data);
                this.save = saveMock;
            });

            await addProduct(req as Request, res as Response);

            expect(statusMock).toHaveBeenCalledWith(201);
        });

        it('returns 400 when price is not a number', async () => {
            req.body = { ...validBody, price: 'not-a-number' };

            await addProduct(req as Request, res as Response);

            expect(statusMock).toHaveBeenCalledWith(400);
            expect(jsonMock).toHaveBeenCalledWith({ message: 'Price must be a number' });
        });

        it('returns 400 when quantity is not an integer', async () => {
            req.body = { ...validBody, quantity: '2.5' };

            await addProduct(req as Request, res as Response);

            expect(statusMock).toHaveBeenCalledWith(400);
            expect(jsonMock).toHaveBeenCalledWith({ message: 'Quantity must be a whole number' });
        });

        it('returns 400 when quantity is negative', async () => {
            req.body = { ...validBody, quantity: '-1' };

            await addProduct(req as Request, res as Response);

            expect(statusMock).toHaveBeenCalledWith(400);
            expect(jsonMock).toHaveBeenCalledWith({ message: 'Quantity must be a whole number' });
        });

        it('creates a product with no image when no file is attached', async () => {
            req.file = undefined;
            const saveMock = jest.fn().mockResolvedValue({ _id: productId, images: [] });
            (mockedProduct as any).mockImplementation(function (this: any, data: any) {
                Object.assign(this, data);
                this.save = saveMock;
            });

            await addProduct(req as Request, res as Response);

            expect(mockedUploadImageBuffer).not.toHaveBeenCalled();
            expect(mockedProduct).toHaveBeenCalledWith(
                expect.objectContaining({ images: [], imagePublicId: undefined })
            );
            expect(statusMock).toHaveBeenCalledWith(201);
        });

        it('uploads the file buffer to Cloudinary and stores the resulting url/publicId when a file is attached', async () => {
            req.file = { buffer: Buffer.from('fake-image') } as any;
            mockedUploadImageBuffer.mockResolvedValue({
                secure_url: 'https://cloudinary.com/fake.jpg',
                public_id: 'fake_public_id',
            } as any);
            const saveMock = jest.fn().mockResolvedValue({ _id: productId });
            (mockedProduct as any).mockImplementation(function (this: any, data: any) {
                Object.assign(this, data);
                this.save = saveMock;
            });

            await addProduct(req as Request, res as Response);

            expect(mockedUploadImageBuffer).toHaveBeenCalledWith(req.file!.buffer);
            expect(mockedProduct).toHaveBeenCalledWith(
                expect.objectContaining({
                    images: ['https://cloudinary.com/fake.jpg'],
                    imagePublicId: 'fake_public_id',
                })
            );
            expect(statusMock).toHaveBeenCalledWith(201);
        });

        it('marks the product out of stock when quantity is 0', async () => {
            req.body = { ...validBody, quantity: '0' };
            const saveMock = jest.fn().mockResolvedValue({ _id: productId });
            (mockedProduct as any).mockImplementation(function (this: any, data: any) {
                Object.assign(this, data);
                this.save = saveMock;
            });

            await addProduct(req as Request, res as Response);

            expect(mockedProduct).toHaveBeenCalledWith(
                expect.objectContaining({ isOutOfStock: true })
            );
        });

        it('returns 500 when the upload fails', async () => {
            req.file = { buffer: Buffer.from('fake-image') } as any;
            mockedUploadImageBuffer.mockRejectedValue(new Error('Cloudinary down'));

            await addProduct(req as Request, res as Response);

            expect(statusMock).toHaveBeenCalledWith(500);
        });

        it('returns 500 when save fails', async () => {
            const saveMock = jest.fn().mockRejectedValue(new Error('DB down'));
            (mockedProduct as any).mockImplementation(function (this: any, data: any) {
                Object.assign(this, data);
                this.save = saveMock;
            });

            await addProduct(req as Request, res as Response);

            expect(statusMock).toHaveBeenCalledWith(500);
        });
    });

    
    describe('listProducts', () => {
        const products = [
            { _id: '1', name: 'A', price: 50 },
            { _id: '2', name: 'B', price: 10 },
            { _id: '3', name: 'C', price: 30 },
        ];

        it('returns all products with no filter/sort applied', async () => {
            mockedProduct.find.mockResolvedValue([...products] as any);

            await listProducts(req as Request, res as Response);

            expect(mockedProduct.find).toHaveBeenCalledWith({});
            expect(statusMock).toHaveBeenCalledWith(200);
            expect(jsonMock).toHaveBeenCalledWith({ products: [...products] });
        });

        it('applies a category filter when provided', async () => {
            req.query = { category: 'Chairs' };
            mockedProduct.find.mockResolvedValue([] as any);

            await listProducts(req as Request, res as Response);

            expect(mockedProduct.find).toHaveBeenCalledWith({ category: 'Chairs' });
        });

        it('sorts low-high by price', async () => {
            req.query = { sort: 'low-high' };
            mockedProduct.find.mockResolvedValue([...products] as any);

            await listProducts(req as Request, res as Response);

            const returned = jsonMock.mock.calls[0][0].products;
            expect(returned.map((p: any) => p.price)).toEqual([10, 30, 50]);
        });

        it('sorts high-low by price', async () => {
            req.query = { sort: 'high-low' };
            mockedProduct.find.mockResolvedValue([...products] as any);

            await listProducts(req as Request, res as Response);

            const returned = jsonMock.mock.calls[0][0].products;
            expect(returned.map((p: any) => p.price)).toEqual([50, 30, 10]);
        });

        it('returns 500 on database error', async () => {
            mockedProduct.find.mockRejectedValue(new Error('DB down'));

            await listProducts(req as Request, res as Response);

            expect(statusMock).toHaveBeenCalledWith(500);
        });
    });

    
    describe('removeProduct', () => {
        beforeEach(() => {
            req.params = { id: productId };
        });

        it('returns 404 when the product does not exist', async () => {
            mockedProduct.findById.mockResolvedValue(null);

            await removeProduct(req as Request, res as Response);

            expect(statusMock).toHaveBeenCalledWith(404);
            expect(mockedDeleteImageIfExists).not.toHaveBeenCalled();
            expect(mockedProduct.findByIdAndDelete).not.toHaveBeenCalled();
        });

        it('deletes the Cloudinary image before deleting the DB record', async () => {
            const product = { _id: productId, imagePublicId: 'fake_public_id' };
            mockedProduct.findById.mockResolvedValue(product as any);
            mockedDeleteImageIfExists.mockResolvedValue(undefined as any);
            mockedProduct.findByIdAndDelete.mockResolvedValue(product as any);

            await removeProduct(req as Request, res as Response);

            expect(mockedDeleteImageIfExists).toHaveBeenCalledWith('fake_public_id');
            expect(mockedProduct.findByIdAndDelete).toHaveBeenCalledWith(productId);
            expect(statusMock).toHaveBeenCalledWith(200);
        });

        it('still deletes the DB record when the product has no image (imagePublicId undefined)', async () => {
            const product = { _id: productId, imagePublicId: undefined };
            mockedProduct.findById.mockResolvedValue(product as any);
            mockedDeleteImageIfExists.mockResolvedValue(undefined as any);
            mockedProduct.findByIdAndDelete.mockResolvedValue(product as any);

            await removeProduct(req as Request, res as Response);

            expect(mockedDeleteImageIfExists).toHaveBeenCalledWith(undefined);
            expect(mockedProduct.findByIdAndDelete).toHaveBeenCalledWith(productId);
            expect(statusMock).toHaveBeenCalledWith(200);
        });

        it('returns 500 when image deletion fails', async () => {
            mockedProduct.findById.mockResolvedValue({ _id: productId, imagePublicId: 'x' } as any);
            mockedDeleteImageIfExists.mockRejectedValue(new Error('Cloudinary down'));

            await removeProduct(req as Request, res as Response);

            expect(statusMock).toHaveBeenCalledWith(500);
            expect(mockedProduct.findByIdAndDelete).not.toHaveBeenCalled();
        });

        it('returns 500 on unexpected database error', async () => {
            mockedProduct.findById.mockRejectedValue(new Error('DB down'));

            await removeProduct(req as Request, res as Response);

            expect(statusMock).toHaveBeenCalledWith(500);
        });
    });

    
    describe('singleProduct', () => {
        beforeEach(() => {
            req.params = { id: productId };
        });

        it('returns 404 when the product does not exist', async () => {
            mockedProduct.findById.mockResolvedValue(null);

            await singleProduct(req as Request, res as Response);

            expect(statusMock).toHaveBeenCalledWith(404);
        });

        it('returns the product on success', async () => {
            const product = { _id: productId, name: 'Test Chair' };
            mockedProduct.findById.mockResolvedValue(product as any);

            await singleProduct(req as Request, res as Response);

            expect(statusMock).toHaveBeenCalledWith(200);
            expect(jsonMock).toHaveBeenCalledWith(product);
        });

        it('returns 500 on unexpected database error', async () => {
            mockedProduct.findById.mockRejectedValue(new Error('DB down'));

            await singleProduct(req as Request, res as Response);

            expect(statusMock).toHaveBeenCalledWith(500);
        });
    });

    
    describe('updateProduct', () => {
        const buildProduct = (overrides = {}) => ({
            _id: productId,
            name: 'Old Name',
            description: 'Old description',
            price: 100,
            category: 'Old Category',
            quantity: 10,
            isOutOfStock: false,
            images: ['https://cloudinary.com/old.jpg'],
            imagePublicId: 'old_public_id',
            save: jest.fn().mockResolvedValue(undefined),
            ...overrides,
        });

        beforeEach(() => {
            req.params = { id: productId };
            req.body = {};
        });

        it('returns 404 when the product does not exist', async () => {
            mockedProduct.findById.mockResolvedValue(null);

            await updateProduct(req as Request, res as Response);

            expect(statusMock).toHaveBeenCalledWith(404);
        });

        it('replaces the image and cleans up the old one when a new file is attached', async () => {
            const product = buildProduct();
            mockedProduct.findById.mockResolvedValue(product as any);
            req.file = { buffer: Buffer.from('new-image') } as any;
            mockedUploadImageBuffer.mockResolvedValue({
                secure_url: 'https://cloudinary.com/new.jpg',
                public_id: 'new_public_id',
            } as any);
            mockedDeleteImageIfExists.mockResolvedValue(undefined as any);

            await updateProduct(req as Request, res as Response);

            expect(mockedUploadImageBuffer).toHaveBeenCalledWith(req.file!.buffer);
            expect(mockedDeleteImageIfExists).toHaveBeenCalledWith('old_public_id');
            expect(product.images).toEqual(['https://cloudinary.com/new.jpg']);
            expect(product.imagePublicId).toBe('new_public_id');
            expect(product.save).toHaveBeenCalled();
            expect(statusMock).toHaveBeenCalledWith(200);
        });

        it('updates only the fields provided, leaving the rest untouched', async () => {
            const product = buildProduct();
            mockedProduct.findById.mockResolvedValue(product as any);
            req.body = { name: 'New Name' };

            await updateProduct(req as Request, res as Response);

            expect(product.name).toBe('New Name');
            expect(product.description).toBe('Old description'); // untouched
            expect(product.price).toBe(100); // untouched
            expect(product.save).toHaveBeenCalled();
            expect(statusMock).toHaveBeenCalledWith(200);
        });

        it('returns 400 when the updated price is not a number', async () => {
            const product = buildProduct();
            mockedProduct.findById.mockResolvedValue(product as any);
            req.body = { price: 'not-a-number' };

            await updateProduct(req as Request, res as Response);

            expect(statusMock).toHaveBeenCalledWith(400);
            expect(jsonMock).toHaveBeenCalledWith({ message: 'Price must be a number' });
            expect(product.save).not.toHaveBeenCalled();
        });

        it('returns 400 when the updated quantity is not a whole number', async () => {
            const product = buildProduct();
            mockedProduct.findById.mockResolvedValue(product as any);
            req.body = { quantity: '3.5' };

            await updateProduct(req as Request, res as Response);

            expect(statusMock).toHaveBeenCalledWith(400);
            expect(jsonMock).toHaveBeenCalledWith({ message: 'Quantity must be a whole number' });
            expect(product.save).not.toHaveBeenCalled();
        });

        it('sets isOutOfStock true when quantity is updated to 0', async () => {
            const product = buildProduct();
            mockedProduct.findById.mockResolvedValue(product as any);
            req.body = { quantity: '0' };

            await updateProduct(req as Request, res as Response);

            expect(product.quantity).toBe(0);
            expect(product.isOutOfStock).toBe(true);
        });

        it('sets isOutOfStock false when quantity is updated above 0', async () => {
            const product = buildProduct({ quantity: 0, isOutOfStock: true });
            mockedProduct.findById.mockResolvedValue(product as any);
            req.body = { quantity: '5' };

            await updateProduct(req as Request, res as Response);

            expect(product.quantity).toBe(5);
            expect(product.isOutOfStock).toBe(false);
        });

        it('returns 500 on unexpected error', async () => {
            mockedProduct.findById.mockRejectedValue(new Error('DB down'));

            await updateProduct(req as Request, res as Response);

            expect(statusMock).toHaveBeenCalledWith(500);
        });
    });

    
    describe('latestProducts', () => {
        it('fetches the 8 most recently created products', async () => {
            const limitMock = jest.fn().mockResolvedValue([{ _id: '1' }, { _id: '2' }]);
            const sortMock = jest.fn().mockReturnValue({ limit: limitMock });
            mockedProduct.find.mockReturnValue({ sort: sortMock } as any);

            await latestProducts(req as Request, res as Response);

            expect(mockedProduct.find).toHaveBeenCalledWith();
            expect(sortMock).toHaveBeenCalledWith({ createdAt: -1 });
            expect(limitMock).toHaveBeenCalledWith(8);
            expect(statusMock).toHaveBeenCalledWith(200);
            expect(jsonMock).toHaveBeenCalledWith({ products: [{ _id: '1' }, { _id: '2' }] });
        });

        it('returns 500 on unexpected database error', async () => {
            mockedProduct.find.mockImplementation(() => {
                throw new Error('DB down');
            });

            await latestProducts(req as Request, res as Response);

            expect(statusMock).toHaveBeenCalledWith(500);
        });
    });
});