// Fájl: config.js (Új, DevOps-barát verzió)
require('dotenv').config(); // Ez a sor tölti be a .env fájl tartalmát

const shopifyConfig = {
    apiSecretKey: process.env.SHOPIFY_API_SECRET_KEY,
};

const smtpConfig = {
    host: process.env.SMTP_HOST,
    port: process.env.SMTP_PORT,
    secure: false,
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
    },
    recipientEmail: process.env.RECIPIENT_EMAIL,
};

module.exports = {
    shopifyConfig,
    smtpConfig,
};