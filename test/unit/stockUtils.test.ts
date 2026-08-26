import mongoose from 'mongoose';
import Product from '../../models/Product';
import { validateStockOnly, validateAndUpdateStock } from '../../utils/stockUtils';

// Mock the Product model module
jest.mock('../../models/Product');

// Mock mongoose sessions: withTransaction just runs the callback directly,
// and endSession is a no-op, so tests don't need a real replica set.
const mockSession = {
  withTransaction: jest.fn(async (fn: () => Promise<void>) => {
    await fn();
  }),
  endSession: jest.fn().mockResolvedValue(undefined),
};

describe('Stock Utils Unit Tests', () => {
  beforeEach(() => {
    // Clear mock calls and implementations between tests
    jest.clearAllMocks();
    mockSession.withTransaction.mockImplementation(async (fn: () => Promise<void>) => {
      await fn();
    });
    jest.spyOn(mongoose, 'startSession').mockResolvedValue(mockSession as any);
  });

  describe('validateStockOnly', () => {
    it('should return valid if all items have sufficient stock', async () => {
      const mockProduct = {
        name: 'Test Laptop',
        quantity: 10,
        isOutOfStock: false,
      };

      (Product.findById as jest.Mock).mockResolvedValue(mockProduct);

      const items = [{ productId: 'prod_1', quantity: 2 }];
      const result = await validateStockOnly(items);

      expect(result.isValid).toBe(true);
      expect(result.stockErrors).toHaveLength(0);
      expect(Product.findById).toHaveBeenCalledWith('prod_1');
    });

    it('should report an error if a product is not found', async () => {
      (Product.findById as jest.Mock).mockResolvedValue(null);

      const items = [{ productId: 'invalid_id', quantity: 1 }];
      const result = await validateStockOnly(items);

      expect(result.isValid).toBe(false);
      expect(result.stockErrors).toContain('Product with ID invalid_id not found');
    });

    it('should report an error if stock is insufficient or marked out of stock', async () => {
      const mockProduct = {
        name: 'Test Mouse',
        quantity: 1,
        isOutOfStock: false,
      };

      (Product.findById as jest.Mock).mockResolvedValue(mockProduct);

      const items = [{ productId: 'prod_2', quantity: 5 }];
      const result = await validateStockOnly(items);

      expect(result.isValid).toBe(false);
      expect(result.stockErrors).toContain('Insufficient stock for product: Test Mouse');
    });
  });

  describe('validateAndUpdateStock', () => {
    it('should deduct stock and set isOutOfStock to true if quantity reaches 0', async () => {
      const mockProduct = {
        name: 'Keyboard',
        quantity: 0, // already decremented, as the atomic $inc would return it
        isOutOfStock: false,
        save: jest.fn().mockResolvedValue(true),
      };

      (Product.findOneAndUpdate as jest.Mock).mockResolvedValue(mockProduct);

      const items = [{ productId: 'prod_3', quantity: 2 }];
      const result = await validateAndUpdateStock(items);

      expect(result.isValid).toBe(true);
      expect(Product.findOneAndUpdate).toHaveBeenCalledWith(
        { _id: 'prod_3', quantity: { $gte: 2 } },
        { $inc: { quantity: -2 } },
        { new: true, session: mockSession }
      );
      expect(mockProduct.isOutOfStock).toBe(true);
      expect(mockProduct.save).toHaveBeenCalledWith({ session: mockSession });
      expect(result.updatedItems).toEqual(items);
      expect(mockSession.endSession).toHaveBeenCalledTimes(1);
    });

    it('should not update items or call save if stock is invalid', async () => {
      const mockExistingProduct = {
        name: 'Monitor',
        quantity: 0,
        isOutOfStock: true,
      };

      (Product.findOneAndUpdate as jest.Mock).mockResolvedValue(null);
      (Product.findById as jest.Mock).mockReturnValue({
        session: jest.fn().mockResolvedValue(mockExistingProduct),
      });

      const items = [{ productId: 'prod_4', quantity: 1 }];
      const result = await validateAndUpdateStock(items);

      expect(result.isValid).toBe(false);
      expect(result.stockErrors).toContain('Insufficient stock for product: Monitor');
      expect(result.updatedItems).toHaveLength(0);
      expect(mockSession.endSession).toHaveBeenCalledTimes(1);
    });

    it('should abort the transaction (not issue manual compensating writes) if a later item in the batch fails', async () => {
      const mockKeyboard = {
        name: 'Keyboard',
        quantity: 3,
        isOutOfStock: false,
        save: jest.fn().mockResolvedValue(true),
      };

      (Product.findOneAndUpdate as jest.Mock)
        .mockResolvedValueOnce(mockKeyboard)  // item 1 (keyboard): succeeds
        .mockResolvedValueOnce(null);         // item 2 (monitor): fails the $gte check

      (Product.findById as jest.Mock).mockReturnValue({
        session: jest.fn().mockResolvedValue({
          name: 'Monitor',
          quantity: 0,
          isOutOfStock: true,
        }),
      });

      const items = [
        { productId: 'prod_keyboard', quantity: 2 },
        { productId: 'prod_monitor', quantity: 1 },
      ];

      const result = await validateAndUpdateStock(items);

      expect(result.isValid).toBe(false);
      expect(result.stockErrors).toContain('Insufficient stock for product: Monitor');
      expect(result.updatedItems).toHaveLength(0);
      expect(Product.findOneAndUpdate).toHaveBeenCalledTimes(2);
      expect(Product.findByIdAndUpdate).not.toHaveBeenCalled();
      expect(mockSession.endSession).toHaveBeenCalledTimes(1);
    });
  });
});