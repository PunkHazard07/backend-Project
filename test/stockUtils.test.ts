import Product from '../models/Product';
import { validateStockOnly, validateAndUpdateStock } from '../utils/stockUtils';

// Mock the Product model module
jest.mock('../models/Product');

describe('Stock Utils Unit Tests', () => {
  beforeEach(() => {
    // Clear mock calls and implementations between tests
    jest.clearAllMocks();
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
        quantity: 2,
        isOutOfStock: false,
        save: jest.fn().mockResolvedValue(true),
      };

      (Product.findById as jest.Mock).mockResolvedValue(mockProduct);

      const items = [{ productId: 'prod_3', quantity: 2 }];
      const result = await validateAndUpdateStock(items);

      expect(result.isValid).toBe(true);
      expect(mockProduct.quantity).toBe(0);
      expect(mockProduct.isOutOfStock).toBe(true);
      expect(mockProduct.save).toHaveBeenCalledTimes(1);
      expect(result.updatedItems).toEqual(items);
    });

    it('should not update items or call save if stock is invalid', async () => {
      const mockProduct = {
        name: 'Monitor',
        quantity: 0,
        isOutOfStock: true,
        save: jest.fn(),
      };

      (Product.findById as jest.Mock).mockResolvedValue(mockProduct);

      const items = [{ productId: 'prod_4', quantity: 1 }];
      const result = await validateAndUpdateStock(items);

      expect(result.isValid).toBe(false);
      expect(mockProduct.save).not.toHaveBeenCalled();
      expect(result.updatedItems).toHaveLength(0);
    });
  });
});