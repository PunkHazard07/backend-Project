const nodemailer = require('nodemailer');

const sendEmail = async (to, subject, html) => {
    const transporter = nodemailer.createTransport({
        service: 'gmail', // You can use other services like 'yahoo', 'outlook', etc.
        auth: {
            user: process.env.EMAIL_USER, // Your email address
            pass: process.env.EMAIL_PASSWORD, // Your email password or app-specific password
        },
    });

    const mailOptions = {
        from: `"Frontend" <${process.env.EMAIL_USER}>`, // Sender address
        to,
        subject, 
        html 
    };

    await transporter.sendMail(mailOptions);
};

module.exports = sendEmail;