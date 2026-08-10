import type { Request, Response } from 'express';
import type { Server as SocketIOServer } from 'socket.io';
import Order from '../models/Order';
import Product from '../models/Product';
import User from '../models/User';
import Payment from '../models/Payment';

type TimePeriod = 'daily' | 'weekly' | 'monthly' | 'yearly' | 'all';

interface DateRange {
    startDate: Date;
    endDate: Date;
}

// Helper function to get time-based filters
const getDateRange = (timePeriod: string): DateRange => {
    const now = new Date();
    let startDate: Date;

    switch (timePeriod as TimePeriod) {
        case 'daily':
            startDate = new Date(new Date().setDate(now.getDate() - 1));
            break;
        case 'weekly':
            startDate = new Date(new Date().setDate(now.getDate() - 7));
            break;
        case 'monthly':
            startDate = new Date(new Date().setMonth(now.getMonth() - 1));
            break;
        case 'yearly':
            startDate = new Date(new Date().setFullYear(now.getFullYear() - 1));
            break;
        default:
            // All time
            startDate = new Date(0);
    }

    return { startDate, endDate: new Date() };
};

// Parses a paginated query param, guarding against garbage/negative input
const parsePageParam = (value: unknown, fallback: number): number => {
    const parsed = parseInt(String(value ?? fallback), 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

// Get all dashboard metrics
export const getDashboardMetrics = async (req: Request, res: Response) => {
    try {
        const { timePeriod = 'all' } = req.query as { timePeriod?: string };
        const ordersPage = parsePageParam(req.query.ordersPage, 1);
        const productsPage = parsePageParam(req.query.productsPage, 1);
        const pageSize = parsePageParam(req.query.pageSize, 5);

        const skip = (page: number) => (page - 1) * pageSize;
        const { startDate, endDate } = getDateRange(timePeriod);

        // Execute all metrics queries in parallel for better performance
        const [
            totalOrders,
            totalSales,
            registeredUsers,
            outOfStockProducts,
            totalProducts,
            successfulPayments,
            failedPayments,
            recentOrders,
            totalOrdersCount,
            recentProducts,
            totalProductsCount,
        ] = await Promise.all([
            // Sales Metrics
            Order.countDocuments({
                createdAt: { $gte: startDate, $lte: endDate },
            }),
            Payment.aggregate([
                {
                    $match: {
                        createdAt: { $gte: startDate, $lte: endDate },
                        status: 'success',
                    },
                },
                { $group: { _id: null, total: { $sum: '$amount' } } },
            ]),

            // Customer Metrics
            User.countDocuments({
                createdAt: { $gte: startDate, $lte: endDate },
                verified: true,
            }),

            // Inventory Metrics
            Product.countDocuments({ isOutOfStock: true }),
            Product.countDocuments(),

            // Finance Metrics - payments now live on their own model, not Order.paymentStatus
            Payment.countDocuments({
                status: 'success',
                createdAt: { $gte: startDate, $lte: endDate },
            }),
            Payment.countDocuments({
                status: 'failed',
                createdAt: { $gte: startDate, $lte: endDate },
            }),

            // Recent Activity - Orders
            Order.find()
                .sort({ createdAt: -1 })
                .skip(skip(ordersPage))
                .limit(pageSize)
                .populate('items.productId', 'name'),

            Order.countDocuments(),

            // Recent Activity - Products
            Product.find()
                .sort({ updatedAt: -1, createdAt: -1 })
                .skip(skip(productsPage))
                .limit(pageSize),

            Product.countDocuments(),
        ]);

        // Set cache headers for better performance
        res.set('Cache-Control', 'private, max-age=10'); // Cache for 10 seconds

        const totalPaymentAttempts = successfulPayments + failedPayments;

        res.json({
            success: true,
            data: {
                salesMetrics: {
                    totalOrders: totalOrders || 0,
                    totalSales: totalSales[0]?.total || 0,
                },
                customerMetrics: {
                    registeredUsers: registeredUsers || 0,
                },
                inventoryMetrics: {
                    outOfStockProducts: outOfStockProducts || 0,
                    totalProducts: totalProducts || 0,
                    stockLevel:
                        totalProducts > 0
                            ? (((totalProducts - outOfStockProducts) / totalProducts) * 100).toFixed(2) + '%'
                            : '0%',
                },
                financeMetrics: {
                    successfulPayments: successfulPayments || 0,
                    failedPayments: failedPayments || 0,
                    paymentSuccessRate:
                        totalPaymentAttempts > 0
                            ? ((successfulPayments / totalPaymentAttempts) * 100).toFixed(2) + '%'
                            : '0%',
                },
                recentActivity: {
                    recentOrders: {
                        data: recentOrders.map((order) => ({
                            id: order._id,
                            amount: order.amount,
                            status: order.status,
                            isPaid: order.isPaid,
                            date: order.createdAt,
                            items: order.items.map((item) => ({
                                name: (item.productId as any)?.name || item.name,
                                quantity: item.quantity,
                            })),
                        })),
                        pagination: {
                            page: ordersPage,
                            pageSize,
                            totalItems: totalOrdersCount,
                            totalPages: Math.ceil(totalOrdersCount / pageSize),
                        },
                    },
                    recentProducts: {
                        data: recentProducts.map((product) => {
                            const wasUpdated = product.updatedAt.getTime() > product.createdAt.getTime();
                            return {
                                id: product._id,
                                name: product.name,
                                price: product.price,
                                action: wasUpdated ? 'Updated' : 'Added',
                                date: wasUpdated ? product.updatedAt : product.createdAt,
                            };
                        }),
                        pagination: {
                            page: productsPage,
                            pageSize,
                            totalItems: totalProductsCount,
                            totalPages: Math.ceil(totalProductsCount / pageSize),
                        },
                    },
                },
            },
        });

        // Notify that someone viewed the dashboard (optional)
        const io = req.app.get('io') as SocketIOServer | undefined;
        if (io) {
            io.to('admin-room').emit('dashboard-viewed', {
                timestamp: new Date(),
                admin: req.admin?.email || 'Anonymous',
            });
        }
    } catch (error: any) {
        console.error('Error fetching dashboard metrics:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch dashboard metrics',
        });
    }
};

// New endpoint to get specific metrics (for partial updates)
export const getSpecificMetric = async (req: Request, res: Response) => {
    const { metricType } = req.params as { metricType: string };

    try {
        const { timePeriod = 'all' } = req.query as { timePeriod?: string };
        const { startDate, endDate } = getDateRange(timePeriod);

        let data: Record<string, unknown> = {};

        switch (metricType.toLowerCase()) {
            case 'sales': {
                const [totalOrders, totalSales] = await Promise.all([
                    Order.countDocuments({
                        createdAt: { $gte: startDate, $lte: endDate },
                    }),
                    Payment.aggregate([
                        {
                            $match: {
                                createdAt: { $gte: startDate, $lte: endDate },
                                status: 'success',
                            },
                        },
                        { $group: { _id: null, total: { $sum: '$amount' } } },
                    ]),
                ]);

                const revenue = totalSales[0]?.total || 0;
                data = {
                    totalOrders: totalOrders || 0,
                    totalSales: revenue,
                    averageOrderValue: totalOrders > 0 ? (revenue / totalOrders).toFixed(2) : 0,
                };
                break;
            }

            case 'inventory': {
                const [outOfStockProducts, totalProducts] = await Promise.all([
                    Product.countDocuments({ isOutOfStock: true }),
                    Product.countDocuments(),
                ]);

                data = {
                    outOfStockProducts: outOfStockProducts || 0,
                    totalProducts: totalProducts || 0,
                    stockLevel:
                        totalProducts > 0
                            ? (((totalProducts - outOfStockProducts) / totalProducts) * 100).toFixed(2) + '%'
                            : '0%',
                };
                break;
            }

            case 'customers': {
                const [newCustomers, totalCustomers] = await Promise.all([
                    User.countDocuments({
                        createdAt: { $gte: startDate, $lte: endDate },
                        verified: true,
                    }),
                    User.countDocuments({ verified: true }),
                ]);

                data = {
                    newCustomers: newCustomers || 0,
                    totalCustomers: totalCustomers || 0,
                    growthRate:
                        totalCustomers > 0 ? ((newCustomers / totalCustomers) * 100).toFixed(2) + '%' : '0%',
                };
                break;
            }

            case 'finance': {
                const [successfulPayments, failedPayments, totalRevenue] = await Promise.all([
                    Payment.countDocuments({
                        status: 'success',
                        createdAt: { $gte: startDate, $lte: endDate },
                    }),
                    Payment.countDocuments({
                        status: 'failed',
                        createdAt: { $gte: startDate, $lte: endDate },
                    }),
                    Payment.aggregate([
                        {
                            $match: {
                                createdAt: { $gte: startDate, $lte: endDate },
                                status: 'success',
                            },
                        },
                        { $group: { _id: null, total: { $sum: '$amount' } } },
                    ]),
                ]);

                const totalAttempts = successfulPayments + failedPayments;
                data = {
                    successfulPayments: successfulPayments || 0,
                    failedPayments: failedPayments || 0,
                    totalRevenue: totalRevenue[0]?.total || 0,
                    conversionRate:
                        totalAttempts > 0 ? ((successfulPayments / totalAttempts) * 100).toFixed(2) + '%' : '0%',
                };
                break;
            }

            default:
                return res.status(400).json({
                    success: false,
                    message: 'Invalid metric type. Valid types: sales, inventory, customers, finance',
                });
        }

        // Set cache headers (shorter cache for specific metrics)
        res.set('Cache-Control', 'private, max-age=5');

        res.json({
            success: true,
            data,
        });
    } catch (error: any) {
        console.error(`Error fetching ${metricType} metrics:`, error);
        res.status(500).json({
            success: false,
            message: `Failed to fetch ${metricType} metrics`,
            error: process.env.NODE_ENV === 'development' ? error.message : undefined,
        });
    }
};

export const getSalesChart = async (req: Request, res: Response) => {
    try {
        const days = parsePageParam(req.query.days, 7);

        const endDate = new Date();
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - (days - 1));
        startDate.setHours(0, 0, 0, 0);

        const salesByDay = await Payment.aggregate([
            {
                $match: {
                    status: 'success',
                    createdAt: { $gte: startDate, $lte: endDate },
                },
            },
            {
                $group: {
                    _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
                    totalSales: { $sum: '$amount' },
                    orderCount: { $sum: 1 },
                },
            }
        ]);

        const salesMap = new Map(salesByDay.map((entry) => [entry._id, entry]));

        // Zero-fill every day in the range so the chart doesn't skip days with no sales
        const chartData = Array.from({ length: days }, (_, i) => {
            const date = new Date(startDate);
            date.setDate(date.getDate() + i);
            const key = date.toISOString().split('T')[0];
            const entry = salesMap.get(key);

            return {
                date: key,
                name: date.toLocaleDateString('en-US', { weekday: 'short' }),
                value: entry?.totalSales || 0,
                orders: entry?.orderCount || 0,
            };
        });

        res.set('Cache-Control', 'private, max-age=30');
        res.json({ success: true, data: chartData });
    } catch (error: any) {
        console.error('Error fetching sales chart data:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch sales chart data',
        });
    }
};