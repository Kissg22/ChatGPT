// Fájl: server.js

const express = require('express');
const nodemailer = require('nodemailer');
const crypto = require('crypto');
const { shopifyConfig, smtpConfig } = require('./config');

const app = express();
const PORT = process.env.PORT || 3000;

const transporter = nodemailer.createTransport(smtpConfig);


// VÁLTOZÁS: Ez a függvény már csak EGYETLEN termékről küld emailt.
// Megkapja a teljes rendelést (a vevő adatai miatt) és a konkrét terméket.
async function sendProductNotificationEmail(order, item) {
    // A címzett továbbra is a központi email cím a szimulációhoz.
    const recipient = smtpConfig.recipientEmail;
    if (!recipient) {
        console.error("Nincs beállítva a 'recipientEmail' a config.js fájlban!");
        return;
    }

    // A Tárgy most már a vendor nevét is tartalmazza.
    const subject = `Új rendelés egy termékre: ${order.name} (Vendor: ${item.vendor})`;
    const customer = order.shipping_address;

    // A Megszólítás most már a konkrét vendornak szól.
    let body = `Tisztelt ${item.vendor}!\n\n`;
    body += `Új rendelés érkezett a(z) ${order.name} azonosítójú vásárlásból az alábbi termékre:\n\n`;
    if (customer) {
        body += `Vevő neve: ${customer.first_name} ${customer.last_name}\n`;
        body += `Szállítási cím:\n${customer.address1 || ''}\n${customer.zip || ''} ${customer.city || ''}\n${customer.country || ''}\n\n`;
    }
    body += "Rendelt termék:\n";
    body += "--------------------------------\n";

    // Most már nem kell ciklus, mert csak egy termékről szól az email.
    body += `- Termék: ${item.title}\n`;
    body += `  SKU: ${item.sku || 'N/A'}\n`;
    body += `  Mennyiség: ${item.quantity} db\n\n`;

    body += "--------------------------------\n\nKérjük, készítse elő a terméket a szállításhoz.\n\nÜdvözlettel,\nA Webáruház Rendszere";

    try {
        await transporter.sendMail({
            from: `"${smtpConfig.auth.user}" <${smtpConfig.auth.user}>`,
            to: recipient,
            subject: subject,
            text: body,
        });
        console.log(`Email sikeresen elküldve a(z) ${recipient} címre a(z) "${item.title}" termékről.`);
    } catch (error) {
        console.error(`Email küldési hiba (${recipient}):`, error);
    }
}

// VÁLTOZÁS: A feldolgozó logika most végigiterál a termékeken.
async function processOrderFromWebhook(order) {
    console.log(`Rendelés feldolgozása: ${order.name}. Termékenkénti email küldés indul...`);
    
    // Ciklussal végigmegyünk a rendelés összes termékén (line_items).
    for (const item of order.line_items) {
        // Minden egyes termékre meghívjuk az emailküldő függvényt.
        await sendProductNotificationEmail(order, item);
    }
}

// === A VÁLTOZATLAN RÉSZEK (validáció és szerver indítás) ===

function verifyShopifyWebhook(req, res, next) {
    const hmacHeader = req.get('X-Shopify-Hmac-Sha256');
    if (!hmacHeader) {
        return res.status(401).send('HMAC validation failed: Missing header');
    }
    const generatedHash = crypto.createHmac('sha256', shopifyConfig.apiSecretKey).update(req.body).digest('base64');
    if (crypto.timingSafeEqual(Buffer.from(generatedHash), Buffer.from(hmacHeader))) {
        next();
    } else {
        return res.status(401).send('HMAC validation failed: Invalid signature');
    }
}

app.post('/api/webhooks', express.raw({ type: 'application/json' }), verifyShopifyWebhook, async (req, res) => {
    const order = JSON.parse(req.body.toString());
    try {
        await processOrderFromWebhook(order);
        res.status(200).send('Webhook processed successfully.');
    } catch (error) {
        console.error("Hiba a rendelés feldolgozása során:", error);
        res.status(500).send('Internal server error.');
    }
});

app.listen(PORT, () => {
    console.log(`Szerver fut a ${PORT} porton. Szimulációs mód: termékenkénti emailek a ${smtpConfig.recipientEmail} címre.`);
});