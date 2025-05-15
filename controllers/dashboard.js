const Order = require('../models/Order');
const Product = require('../models/Product');
const User = require('../models/User');

// Helper function to get time-based filters
const getDateRange = (timePeriod) => {
    const now = new Date();
    let startDate;
    
    switch(timePeriod) {
      case 'daily':
        startDate = new Date(now.setDate(now.getDate() - 1));
        break;
      case 'weekly':
        startDate = new Date(now.setDate(now.getDate() - 7));
        break;
      case 'monthly':
        startDate = new Date(now.setMonth(now.getMonth() - 1));
        break;
      case 'yearly':
        startDate = new Date(now.setFullYear(now.getFullYear() - 1));
        break;
      default:
        // All time
        startDate = new Date(0);
    }
    
    return { startDate, endDate: new Date() };
  };
  
  // Get all dashboard metrics
  exports.getDashboardMetrics = async (req, res) => {
    try {
      const {
        timePeriod = 'all', 
        ordersPage = 1, 
        productsPage = 1, 
        pageSize = 5
      } = req.query;
      const skip = (page) => (page - 1) * pageSize;
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
        totalProductsCount
      ] = await Promise.all([
        // Sales Metrics
        Order.countDocuments({ 
          createdAt: { $gte: startDate, $lte: endDate } 
        }),
        Order.aggregate([
          { 
            $match: { 
              createdAt: { $gte: startDate, $lte: endDate },
              paymentStatus: true 
            } 
          },
          { $group: { _id: null, total: { $sum: "$amount" } } }
        ]),
        
        // Customer Metrics
        User.countDocuments({ 
          createdAt: { $gte: startDate, $lte: endDate },
          verified: true 
        }),
        
        // Inventory Metrics
        Product.countDocuments({ isOutOfStock: true }),
        Product.countDocuments(),
        
        // Finance Metrics
        Order.countDocuments({ 
          paymentStatus: true,
          createdAt: { $gte: startDate, $lte: endDate } 
        }),
        Order.countDocuments({ 
          paymentStatus: false,
          createdAt: { $gte: startDate, $lte: endDate } 
        }),
        
        // Recent Activity - Orders
        Order.find()
        .sort({ createdAt: -1 })
        .skip(skip(ordersPage))
        .limit(parseInt(pageSize))
        .populate('items.productId', 'name'),
      
        Order.countDocuments(),
        
        // Recent Activity - Products
        Product.find()
        .sort({ updatedAt: -1, createdAt: -1 })
        .skip(skip(productsPage))
        .limit(parseInt(pageSize)),
      
        Product.countDocuments()
      ]);

      // Set cache headers for better performance
      res.set('Cache-Control', 'private, max-age=10'); // Cache for 10 seconds
  
      res.json({
        success: true,
        data: {
          salesMetrics: {
            totalOrders: totalOrders || 0,
            totalSales: totalSales[0]?.total || 0
          },
          customerMetrics: {
            registeredUsers: registeredUsers || 0
          },
          inventoryMetrics: {
            outOfStockProducts: outOfStockProducts || 0,
            totalProducts: totalProducts || 0,
            stockLevel: totalProducts > 0 
              ? ((totalProducts - outOfStockProducts) / totalProducts * 100).toFixed(2) + '%'
              : '0%'
          },
          financeMetrics: {
            successfulPayments: successfulPayments || 0,
            failedPayments: failedPayments || 0,
            paymentSuccessRate: totalOrders > 0 
              ? ((successfulPayments / totalOrders) * 100).toFixed(2) + '%'
              : '0%'
          },
          recentActivity: {
            recentOrders: {
              data: recentOrders.map(order => ({
                id: order._id,
                amount: order.amount,
                status: order.status,
                date: order.createdAt,
                items: order.items.map(item => ({
                  name: item.productId?.name || item.name,
                  quantity: item.quantity
                }))
              })),
              pagination: {
                page: parseInt(ordersPage),
                pageSize: parseInt(pageSize),
                totalItems: totalOrdersCount,
                totalPages: Math.ceil(totalOrdersCount / parseInt(pageSize))
              }
            },
            recentProducts: {
              data: recentProducts.map(product => ({
                id: product._id,
                name: product.name,
                price: product.price,
                action: product.createdAt === product.updatedAt ? 'Added' : 'Updated',
                date: product.updatedAt > product.createdAt ? product.updatedAt : product.createdAt
              })),
              pagination: {
                page: parseInt(productsPage),
                pageSize: parseInt(pageSize),
                totalItems: totalProductsCount,
                totalPages: Math.ceil(totalProductsCount / parseInt(pageSize))
              }
            }
          }
        }
      });
      
      // Notify that someone viewed the dashboard (optional)
      const io = req.app.get('io');
      if (io) {
        io.to('admin-room').emit('dashboard-viewed', { 
          timestamp: new Date(),
          user: req.user?.email || 'Anonymous'
        });
      }
      
    } catch (error) {
      console.error('Error fetching dashboard metrics:', error);
      res.status(500).json({ 
        success: false, 
        message: 'Failed to fetch dashboard metrics' 
      });
    }
  };

  // New endpoint to get specific metrics (for partial updates)
  exports.getSpecificMetric = async (req, res) => {
      try {
          const { metricType } = req.params;
          const { timePeriod = 'all' } = req.query;
          const { startDate, endDate } = getDateRange(timePeriod);
          
          let data = {};
          
          switch(metricType.toLowerCase()) {
              case 'sales':
                  const [totalOrders, totalSales] = await Promise.all([
                      Order.countDocuments({ 
                          createdAt: { $gte: startDate, $lte: endDate } 
                      }),
                      Order.aggregate([
                          { 
                              $match: { 
                                  createdAt: { $gte: startDate, $lte: endDate },
                                  paymentStatus: true 
                              } 
                          },
                          { $group: { _id: null, total: { $sum: "$amount" } } }
                      ])
                  ]);
                  
                  data = {
                      totalOrders: totalOrders || 0,
                      totalSales: totalSales[0]?.total || 0,
                      averageOrderValue: totalOrders > 0 
                          ? (totalSales[0]?.total / totalOrders).toFixed(2)
                          : 0
                  };
                  break;
                  
              case 'inventory':
                  const [outOfStockProducts, totalProducts] = await Promise.all([
                      Product.countDocuments({ isOutOfStock: true }),
                      Product.countDocuments()
                  ]);
                  
                  data = {
                      outOfStockProducts: outOfStockProducts || 0,
                      totalProducts: totalProducts || 0,
                      stockLevel: totalProducts > 0 
                          ? ((totalProducts - outOfStockProducts) / totalProducts * 100).toFixed(2) + '%'
                          : '0%'
                  };
                  break;
                  
              case 'customers':
                  const [newCustomers, totalCustomers] = await Promise.all([
                      User.countDocuments({ 
                          createdAt: { $gte: startDate, $lte: endDate },
                          verified: true 
                      }),
                      User.countDocuments({ verified: true })
                  ]);
                  
                  data = {
                      newCustomers: newCustomers || 0,
                      totalCustomers: totalCustomers || 0,
                      growthRate: totalCustomers > 0 
                          ? ((newCustomers / totalCustomers) * 100).toFixed(2) + '%'
                          : '0%'
                  };
                  break;
                  
              case 'finance':
                  const [successfulPayments, failedPayments, totalRevenue] = await Promise.all([
                      Order.countDocuments({ 
                          paymentStatus: true,
                          createdAt: { $gte: startDate, $lte: endDate } 
                      }),
                      Order.countDocuments({ 
                          paymentStatus: false,
                          createdAt: { $gte: startDate, $lte: endDate } 
                      }),
                      Order.aggregate([
                          { 
                              $match: { 
                                  createdAt: { $gte: startDate, $lte: endDate },
                                  paymentStatus: true 
                              } 
                          },
                          { $group: { _id: null, total: { $sum: "$amount" } } }
                      ])
                  ]);
                  
                  data = {
                      successfulPayments: successfulPayments || 0,
                      failedPayments: failedPayments || 0,
                      totalRevenue: totalRevenue[0]?.total || 0,
                      conversionRate: (successfulPayments + failedPayments) > 0
                          ? ((successfulPayments / (successfulPayments + failedPayments)) * 100).toFixed(2) + '%'
                          : '0%'
                  };
                  break;
                  
              default:
                  return res.status(400).json({
                      success: false,
                      message: 'Invalid metric type. Valid types: sales, inventory, customers, finance'
                  });
          }
          
          // Set cache headers (shorter cache for specific metrics)
          res.set('Cache-Control', 'private, max-age=5');
          
          res.json({
              success: true,
              data
          });
          
      } catch (error) {
          console.error(`Error fetching ${metricType} metrics:`, error);
          res.status(500).json({ 
              success: false, 
              message: `Failed to fetch ${metricType} metrics`,
              error: process.env.NODE_ENV === 'development' ? error.message : undefined
          });
      }
  };