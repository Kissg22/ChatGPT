// Fájl: api/webhooks.js

const crypto = require('crypto');
const nodemailer = require('nodemailer');
const { shopifyConfig, smtpConfig } = require('../config');

// Vercel-nek jelöljük, hogy raw body-t várunk
module.exports.config = {
  api: {
    bodyParser: false,
  },
};

const transporter = nodemailer.createTransport(smtpConfig);

function verifyShopifyWebhook(rawBodyBuffer, hmacHeader) {
  if (!hmacHeader) return false;
  const generatedHash = crypto
    .createHmac('sha256', shopifyConfig.apiSecretKey)
    .update(rawBodyBuffer)
    .digest('base64');
  return crypto.timingSafeEqual(Buffer.from(generatedHash), Buffer.from(hmacHeader));
}

async function sendProductNotificationEmail(order, item) {
  const recipient = smtpConfig.recipientEmail;
  if (!recipient) {
    console.error("Hiányzó recipientEmail a config.js-ben!");
    return;
  }

  const subject = `Új rendelés egy termékre: ${order.name} (Vendor: ${item.vendor})`;
  const customer = order.shipping_address;
  let body = `Tisztelt ${item.vendor}!\n\n`;
  body += `Rendelés azonosító: ${order.name}\n\n`;

  if (customer) {
    body += `Vevő: ${customer.first_name} ${customer.last_name}\n`;
    body += `Cím: ${customer.address1 || ''}, ${customer.zip || ''} ${customer.city || ''}, ${customer.country || ''}\n\n`;
  }

  body += `Termék: ${item.title}\n`;
  body += `SKU: ${item.sku || 'N/A'}\n`;
  body += `Mennyiség: ${item.quantity} db\n\n`;
  body += "Kérjük, készítse elő a terméket.\n\nÜdvözlettel,\nWebáruház";

  try {
    await transporter.sendMail({
      from: `"${smtpConfig.auth.user}" <${smtpConfig.auth.user}>`,
      to: recipient,
      subject,
      text: body,
    });
    console.log(`Email elküldve: ${item.title}`);
  } catch (err) {
    console.error('Email küldési hiba:', err);
  }
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).send('Method Not Allowed');
    return;
  }

  // raw body beolvasása
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
  }
  const rawBody = Buffer.concat(chunks);

  const hmacHeader = req.headers['x-shopify-hmac-sha256'];
  if (!verifyShopifyWebhook(rawBody, hmacHeader)) {
    res.status(401).send('HMAC validation failed');
    return;
  }

  let order;
  try {
    order = JSON.parse(rawBody.toString());
  } catch {
    res.status(400).send('Invalid JSON');
    return;
  }

  try {
    for (const item of order.line_items) {
      // eslint-disable-next-line no-await-in-loop
      await sendProductNotificationEmail(order, item);
    }
    res.status(200).send('Webhook processed');
  } catch (err) {
    console.error('Hiba a webhook feldolgozásában:', err);
    res.status(500).send('Internal Server Error');
  }
};
