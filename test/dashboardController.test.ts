import type { Request, Response } from 'express';
import { getDashboardMetrics, getSpecificMetric, getSalesChart } from '../controllers/dashboardController';
import Order from '../models/Order';
import Product from '../models/Product';
import User from '../models/User';
import Payment from '../models/Payment';

jest.mock('../models/Order');
jest.mock('../models/Product');
jest.mock('../models/User');
jest.mock('../models/Payment');

const mockedOrder = Order as unknown as jest.Mocked<typeof Order>;
const mockedProduct = Product as unknown as jest.Mocked<typeof Product>;
const mockedUser = User as unknown as jest.Mocked<typeof User>;
const mockedPayment = Payment as unknown as jest.Mocked<typeof Payment>;

// Builds a chainable mock matching Mongoose's query builder (.sort().skip().limit()...)
// so controller code that chains off Model.find() resolves without a real DB.
const mockQueryChain = (resolvedValue: unknown) => {
    const chain: any = {
        sort: jest.fn(() => chain),
        skip: jest.fn(() => chain),
        limit: jest.fn(() => chain),
        populate: jest.fn(() => Promise.resolve(resolvedValue)),
    };
    // populate() is the terminal call for Order.find(); Product.find() has no populate,
    // so make the chain itself thenable too. Promise.resolve() handles both plain values
    // and promises, and the resulting signature satisfies the PromiseLike<T> contract.
    chain.then = (onFulfilled?: (v: unknown) => unknown, onRejected?: (err: unknown) => unknown) =>
        Promise.resolve(resolvedValue).then(onFulfilled, onRejected);
    return chain;
};

describe('dashboardController', () => {
    let req: Partial<Request>;
    let res: Partial<Response>;
    let jsonMock: jest.Mock;
    let statusMock: jest.Mock;
    let setMock: jest.Mock;

    beforeEach(() => {
        jest.clearAllMocks();
        jsonMock = jest.fn();
        statusMock = jest.fn().mockReturnValue({ json: jsonMock });
        setMock = jest.fn();
        res = { status: statusMock, json: jsonMock, set: setMock } as unknown as Response;
        req = { query: {}, app: { get: jest.fn().mockReturnValue(undefined) } as any };
    });

    describe('getDashboardMetrics', () => {
        const productId = '507f1f77bcf86cd799439011';

        const mockOrder = {
            _id: 'order1',
            amount: 15000,
            status: 'Delivered',
            isPaid: true,
            createdAt: new Date('2026-08-01'),
            items: [{ productId: { name: 'Chair' }, quantity: 2, name: 'Chair' }],
        };

        const mockProduct = {
            _id: productId,
            name: 'Table',
            price: 25000,
            createdAt: new Date('2026-07-01'),
            updatedAt: new Date('2026-08-01'),
        };

        const setupHappyPath = () => {
            mockedOrder.countDocuments
                .mockResolvedValueOnce(10 as any) // totalOrders (date-filtered)
                .mockResolvedValueOnce(50 as any); // totalOrdersCount (unfiltered, for pagination)
            mockedOrder.find.mockReturnValue(mockQueryChain([mockOrder]) as any);

            mockedPayment.aggregate.mockResolvedValue([{ _id: null, total: 150000 }] as any);
            mockedPayment.countDocuments
                .mockResolvedValueOnce(8 as any) // successfulPayments
                .mockResolvedValueOnce(2 as any); // failedPayments

            mockedUser.countDocuments.mockResolvedValue(5 as any); // registeredUsers

            mockedProduct.countDocuments
                .mockResolvedValueOnce(3 as any) // outOfStockProducts
                .mockResolvedValueOnce(20 as any) // totalProducts
                .mockResolvedValueOnce(20 as any); // totalProductsCount
            mockedProduct.find.mockReturnValue(mockQueryChain([mockProduct]) as any);
        };

        it('returns aggregated metrics with correct shape and derived percentages', async () => {
            setupHappyPath();

            await getDashboardMetrics(req as Request, res as Response);

            expect(setMock).toHaveBeenCalledWith('Cache-Control', 'private, max-age=10');
            expect(jsonMock).toHaveBeenCalledWith({
                success: true,
                data: expect.objectContaining({
                    salesMetrics: { totalOrders: 10, totalSales: 150000 },
                    customerMetrics: { registeredUsers: 5 },
                    inventoryMetrics: {
                        outOfStockProducts: 3,
                        totalProducts: 20,
                        stockLevel: '85.00%', // (20-3)/20 * 100
                    },
                    financeMetrics: {
                        successfulPayments: 8,
                        failedPayments: 2,
                        paymentSuccessRate: '80.00%', // 8/(8+2) * 100
                    },
                }),
            });
        });

        it('falls back to item.name when items.productId is not populated (product deleted)', async () => {
            setupHappyPath();
            mockedOrder.find.mockReturnValue(
                mockQueryChain([{ ...mockOrder, items: [{ productId: null, quantity: 1, name: 'Deleted Item' }] }]) as any
            );

            await getDashboardMetrics(req as Request, res as Response);

            const payload = jsonMock.mock.calls[0][0];
            expect(payload.data.recentActivity.recentOrders.data[0].items[0].name).toBe('Deleted Item');
        });

        it('returns 0%/0 defaults when there is no data yet (empty store)', async () => {
            mockedOrder.countDocuments.mockResolvedValueOnce(0 as any).mockResolvedValueOnce(0 as any);
            mockedOrder.find.mockReturnValue(mockQueryChain([]) as any);
            mockedPayment.aggregate.mockResolvedValue([] as any); // no successful payments -> no $group output row
            mockedPayment.countDocuments.mockResolvedValueOnce(0 as any).mockResolvedValueOnce(0 as any);
            mockedUser.countDocuments.mockResolvedValue(0 as any);
            mockedProduct.countDocuments
                .mockResolvedValueOnce(0 as any)
                .mockResolvedValueOnce(0 as any)
                .mockResolvedValueOnce(0 as any);
            mockedProduct.find.mockReturnValue(mockQueryChain([]) as any);

            await getDashboardMetrics(req as Request, res as Response);

            const payload = jsonMock.mock.calls[0][0];
            expect(payload.data.salesMetrics.totalSales).toBe(0);
            expect(payload.data.inventoryMetrics.stockLevel).toBe('0%');
            expect(payload.data.financeMetrics.paymentSuccessRate).toBe('0%');
        });

        it('respects ordersPage/productsPage/pageSize query params for pagination', async () => {
            setupHappyPath();
            req.query = { ordersPage: '2', productsPage: '3', pageSize: '10' };

            await getDashboardMetrics(req as Request, res as Response);

            const payload = jsonMock.mock.calls[0][0];
            expect(payload.data.recentActivity.recentOrders.pagination).toEqual(
                expect.objectContaining({ page: 2, pageSize: 10 })
            );
            expect(payload.data.recentActivity.recentProducts.pagination).toEqual(
                expect.objectContaining({ page: 3, pageSize: 10 })
            );
        });

        it('falls back to default pagination for garbage/negative query params', async () => {
            setupHappyPath();
            req.query = { ordersPage: '-5', productsPage: 'abc', pageSize: '0' };

            await getDashboardMetrics(req as Request, res as Response);

            const payload = jsonMock.mock.calls[0][0];
            expect(payload.data.recentActivity.recentOrders.pagination.page).toBe(1);
            expect(payload.data.recentActivity.recentProducts.pagination.page).toBe(1);
            expect(payload.data.recentActivity.recentOrders.pagination.pageSize).toBe(5);
        });

        it('returns 500 when a query fails', async () => {
            mockedOrder.countDocuments.mockRejectedValue(new Error('DB down'));

            await getDashboardMetrics(req as Request, res as Response);

            expect(statusMock).toHaveBeenCalledWith(500);
            expect(jsonMock).toHaveBeenCalledWith({
                success: false,
                message: 'Failed to fetch dashboard metrics',
            });
        });
    });

    describe('getSpecificMetric', () => {
        const runWith = (metricType: string) => {
            req.params = { metricType };
            return getSpecificMetric(req as Request, res as Response);
        };

        it('returns sales metrics with averageOrderValue', async () => {
            mockedOrder.countDocuments.mockResolvedValue(4 as any);
            mockedPayment.aggregate.mockResolvedValue([{ _id: null, total: 40000 }] as any);

            await runWith('sales');

            expect(jsonMock).toHaveBeenCalledWith({
                success: true,
                data: { totalOrders: 4, totalSales: 40000, averageOrderValue: '10000.00' },
            });
        });

        it('returns 0 averageOrderValue when there are no orders', async () => {
            mockedOrder.countDocuments.mockResolvedValue(0 as any);
            mockedPayment.aggregate.mockResolvedValue([] as any);

            await runWith('sales');

            expect(jsonMock).toHaveBeenCalledWith({
                success: true,
                data: { totalOrders: 0, totalSales: 0, averageOrderValue: 0 },
            });
        });

        it('returns inventory metrics with stockLevel', async () => {
            mockedProduct.countDocuments.mockResolvedValueOnce(5 as any).mockResolvedValueOnce(25 as any);

            await runWith('inventory');

            expect(jsonMock).toHaveBeenCalledWith({
                success: true,
                data: { outOfStockProducts: 5, totalProducts: 25, stockLevel: '80.00%' },
            });
        });

        it('returns customer metrics with growthRate', async () => {
            mockedUser.countDocuments.mockResolvedValueOnce(10 as any).mockResolvedValueOnce(50 as any);

            await runWith('customers');

            expect(jsonMock).toHaveBeenCalledWith({
                success: true,
                data: { newCustomers: 10, totalCustomers: 50, growthRate: '20.00%' },
            });
        });

        it('returns finance metrics with conversionRate', async () => {
            mockedPayment.countDocuments.mockResolvedValueOnce(9 as any).mockResolvedValueOnce(1 as any);
            mockedPayment.aggregate.mockResolvedValue([{ _id: null, total: 90000 }] as any);

            await runWith('finance');

            expect(jsonMock).toHaveBeenCalledWith({
                success: true,
                data: {
                    successfulPayments: 9,
                    failedPayments: 1,
                    totalRevenue: 90000,
                    conversionRate: '90.00%',
                },
            });
        });

        it('is case-insensitive on metricType', async () => {
            mockedProduct.countDocuments.mockResolvedValueOnce(0 as any).mockResolvedValueOnce(10 as any);

            await runWith('INVENTORY');

            expect(statusMock).not.toHaveBeenCalledWith(400);
        });

        it('returns 400 for an unknown metricType', async () => {
            await runWith('nonsense');

            expect(statusMock).toHaveBeenCalledWith(400);
            expect(jsonMock).toHaveBeenCalledWith({
                success: false,
                message: 'Invalid metric type. Valid types: sales, inventory, customers, finance',
            });
        });

        it('returns 500 when the underlying query fails', async () => {
            mockedOrder.countDocuments.mockRejectedValue(new Error('DB down'));

            await runWith('sales');

            expect(statusMock).toHaveBeenCalledWith(500);
            const payload = jsonMock.mock.calls[0][0];
            expect(payload.success).toBe(false);
            expect(payload.message).toBe('Failed to fetch sales metrics');
        });
    });

    describe('getSalesChart', () => {
        beforeEach(() => {
            jest.useFakeTimers();
            jest.setSystemTime(new Date('2026-08-10T12:00:00Z'));
        });

        afterEach(() => {
            jest.useRealTimers();
        });

        it('returns 7 zero-filled days by default, in chronological order, with matching entries populated', async () => {
            // Range for a system date of 2026-08-10 is 2026-08-04 .. 2026-08-10 (7 days inclusive)
            mockedPayment.aggregate.mockResolvedValue([
                { _id: '2026-08-04', totalSales: 5000, orderCount: 2 },
                { _id: '2026-08-10', totalSales: 12000, orderCount: 3 },
            ] as any);

            await getSalesChart(req as Request, res as Response);

            expect(setMock).toHaveBeenCalledWith('Cache-Control', 'private, max-age=30');
            const payload = jsonMock.mock.calls[0][0];
            expect(payload.success).toBe(true);
            expect(payload.data).toHaveLength(7);
            expect(payload.data[0]).toEqual({ date: '2026-08-04', name: 'Tue', value: 5000, orders: 2 });
            expect(payload.data[6]).toEqual({ date: '2026-08-10', name: 'Mon', value: 12000, orders: 3 });
            // days with no matching aggregate entry are zero-filled, not omitted
            expect(payload.data[3]).toEqual({ date: '2026-08-07', name: 'Fri', value: 0, orders: 0 });
        });

        it('honors a custom ?days= query param', async () => {
            mockedPayment.aggregate.mockResolvedValue([] as any);
            req.query = { days: '3' };

            await getSalesChart(req as Request, res as Response);

            const payload = jsonMock.mock.calls[0][0];
            expect(payload.data).toHaveLength(3);
            expect(payload.data.map((d: any) => d.date)).toEqual(['2026-08-08', '2026-08-09', '2026-08-10']);
        });

        it('falls back to 7 days for a garbage ?days= value', async () => {
            mockedPayment.aggregate.mockResolvedValue([] as any);
            req.query = { days: 'not-a-number' };

            await getSalesChart(req as Request, res as Response);

            const payload = jsonMock.mock.calls[0][0];
            expect(payload.data).toHaveLength(7);
        });

        it('only aggregates successful payments within the date range', async () => {
            mockedPayment.aggregate.mockResolvedValue([] as any);

            await getSalesChart(req as Request, res as Response);

            const pipeline = mockedPayment.aggregate.mock.calls[0][0] as any[];
            expect(pipeline[0].$match.status).toBe('success');
            expect(pipeline[0].$match.createdAt).toEqual({
                $gte: new Date('2026-08-04T00:00:00.000Z'),
                $lte: new Date('2026-08-10T12:00:00.000Z'),
            });
        });

        it('returns 500 when the aggregation fails', async () => {
            mockedPayment.aggregate.mockRejectedValue(new Error('DB down'));

            await getSalesChart(req as Request, res as Response);

            expect(statusMock).toHaveBeenCalledWith(500);
            expect(jsonMock).toHaveBeenCalledWith({
                success: false,
                message: 'Failed to fetch sales chart data',
            });
        });
    });
});