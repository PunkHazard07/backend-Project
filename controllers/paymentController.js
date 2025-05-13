const User = require("../models/User.js");
const Order = require("../models/Order.js");
const axios = require("axios"); 
const { validateStockOnly, validateAndUpdateStock } = require("../utils/stockUtils.js");


//payment on cash
exports.paymentOnCash = async (req, res) => {
    try {
        const userId = req.user._id; //get the user id from the token
        const {firstName, lastName, email, phone,  items, amount, address, country} = req.body; //destructuring the data from the body

        //validate data before creating order
        if (!items || !Array.isArray(items) || items.length === 0) {
            return res.status(400).json({
                success:false, 
                message:"Items are required"
            });
        }

        // validate that each item has a productId
        for (const item of items) {
            if (!item.productId) {
                return res.status(400).json({
                    success:false, 
                    message:"Product ID is required for each item"
                });
            }
        }

        const stockValidation = await validateAndUpdateStock(items);
        if (!stockValidation.isValid) {
            return res.status(400).json({
                success: false,
                message: "Stock validation failed",
                errors: stockValidation.stockErrors
            });
        }

        const newOrder = new Order({
            userId,
            firstName,
            lastName,
            email,
            phone,
            items: stockValidation.updatedItems, // use updated items after stock validation
            amount,
            country,
            address,
            paymentMethod: "Cash",
            paymentStatus: false, // complete at delivery
            status: "Pending", // initial status of the order
        });

        await newOrder.save(); //save the order to the database
        
        // clear user cart after successful order
        await User.findByIdAndUpdate(userId, {cartData: []}, {new:true});


        res.status(201).json({success:true, message:"Order placed successfully", order:newOrder});

    } catch (error) {
        console.log(error);
        res.status(500).json({success:false, message: error.message});
        
    }
};


// ---- payment on paystack

exports.paystackInit = async (req, res) => {
    try {
        const userId = req.user._id; // get the user id from the token
        const { firstName, lastName, email, phone, items, amount, address, country } = req.body; // destructuring the data from the body

        // validate data before creating order
        if (!items || !Array.isArray(items) || items.length === 0) {
            return res.status(400).json({
                success: false,
                message: "Items are required"
            });
        }


        const stockValidation = await validateStockOnly(items);
        if (!stockValidation.isValid) {
            return res.status(400).json({
                success: false,
                message: "Stock validation failed",
                errors: stockValidation.stockErrors
            });
        }

        // initialize Paystack payment
        const paystackResponse = await axios.post(
            "https://api.paystack.co/transaction/initialize",
            {
                email,
                amount: amount * 100, // Paystack expects amount in kobo (smallest currency unit)
                callback_url: `${process.env.FRONTEND_URL}/order-success`,
            },
            {
                headers: {
                    Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`
                }
            }
        );

        if (paystackResponse.data.status) {
            const newOrder = new Order({
                userId,
                firstName,
                lastName,
                email,
                phone,
                items,
                amount,
                country,
                address,
                paymentMethod: "Paystack",
                paymentStatus: false, // will be updated after successful payment
                status: "Pending", // initial status of the order
                paystackReference: paystackResponse.data.data.reference // store Paystack reference
            });

            await newOrder.save(); // save the order to the database

            res.status(201).json({
                success: true,
                message: "Payment initialized successfully",
                authorization_url: paystackResponse.data.data.authorization_url,
                paystackReference: paystackResponse.data.data.reference,
                order: newOrder
            });
        } else {
            res.status(400).json({
                success: false,
                message: "Failed to initialize payment"
            });
        }
    } catch (error) {
        console.log(error);
        res.status(500).json({ success: false, message: error.message });
    }
};


exports.verifyPaystackTransaction = async (req, res) => {
    try {
        const { reference, orderId } = req.params;

        if (!reference || !orderId) {
            return res.status(400).json({ success: false, message: "Reference and orderId required" });
        }

        const paystackResponse = await axios.get(
            `https://api.paystack.co/transaction/verify/${reference}`,
            {
                headers: {
                    Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`
                }
            }
        );

        if (
            paystackResponse.data.status &&
            paystackResponse.data.data.status === "success"
        ) {
            const order = await Order.findById(orderId);
            if (!order) {
                return res.status(404).json({ success: false, message: "Order not found" });
            }

            if (order.paymentStatus) {
                return res.status(400).json({ success: false, message: "Order already paid" });
            }

            const stockValidation = await validateAndUpdateStock(order.items);
            if (!stockValidation.isValid) {
                return res.status(400).json({
                    success: false,
                    message: "Stock update failed after payment",
                    errors: stockValidation.stockErrors
                });
            }

            order.paymentStatus = true;
            await order.save();

            await User.findByIdAndUpdate(order.userId, { cartData: [] });

            res.status(200).json({
                success: true,
                message: "Transaction verified and order updated",
                order
            });
        } else {
            res.status(400).json({ success: false, message: "Transaction verification failed" });
        }
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
