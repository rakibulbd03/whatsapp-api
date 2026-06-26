const express = require('express');
const { Client, RemoteAuth } = require('whatsapp-web.js');
const { MongoStore } = require('wwebjs-mongo');
const mongoose = require('mongoose');

const app = express();
const port = process.env.PORT || 3000;

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://rakibbfadu_db_user:Woirfl3WQh6DFAUp@cluster0.g9ciz0r.mongodb.net/?appName=Cluster0';

app.use(express.json());
let qrCodeData = '';

mongoose.connect(MONGODB_URI).then(() => {
    console.log('MongoDB Connected successfully!');
    const store = new MongoStore({ mongoose: mongoose });

    const client = new Client({
        authStrategy: new RemoteAuth({
            store: store,
            backupSyncIntervalMs: 300000
        }),
        puppeteer: {
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        }
    });

    client.on('qr', (qr) => {
        qrCodeData = qr; 
        console.log('QR Code Text Ready! Go to /qr to copy it.');
    });

    client.on('ready', () => {
        console.log('WhatsApp Client is ready!');
        qrCodeData = ''; 
    });

    client.on('remote_session_saved', () => {
        console.log('Session successfully saved to MongoDB');
    });

    client.initialize();

    // 100% গ্যারান্টিড Text ভিত্তিক পেজ
    app.get('/qr', (req, res) => {
        res.setHeader('Content-Type', 'text/html');
        if (qrCodeData) {
            res.send(`
                <div style="max-width: 800px; margin: 50px auto; font-family: Arial; text-align: center; background: #f9f9f9; padding: 30px; border-radius: 10px; box-shadow: 0 4px 10px rgba(0,0,0,0.1);">
                    <h2 style="color: #d93025;">ধাপ ১: নিচের বক্সে থাকা সম্পূর্ণ লেখাটি (Text) কপি করুন</h2>
                    <textarea style="width: 100%; height: 150px; font-size: 14px; padding: 10px; border: 2px solid #ccc; border-radius: 5px;" onclick="this.select()">${qrCodeData}</textarea>
                    
                    <h2 style="color: #1a73e8; margin-top: 30px;">ধাপ ২: QR কোড জেনারেট করে স্ক্যান করুন</h2>
                    <p style="font-size: 16px;">এবার <a href="https://www.the-qrcode-generator.com/" target="_blank" style="color: white; background: #1a73e8; padding: 10px 20px; text-decoration: none; border-radius: 5px; font-weight: bold;">এখানে ক্লিক করে</a> QR Generator ওয়েবসাইটে যান।</p>
                    <p style="font-size: 16px; color: #555;">সেখানে <b>Free Text</b> অপশন সিলেক্ট করে কপি করা লেখাটি পেস্ট করুন। ডানপাশে যে নিখুঁত QR কোডটি আসবে, দ্রুত আপনার ফোন দিয়ে সেটি স্ক্যান করুন!</p>
                </div>
            `);
        } else {
            res.send('<h2 style="text-align:center; padding-top: 50px; font-family: Arial;">QR Code এখনও তৈরি হয়নি অথবা কানেক্ট হয়ে গেছে। Render-এর লগ চেক করুন।</h2>');
        }
    });

    app.get('/check-number/:phone', async (req, res) => {
        let phone = req.params.phone;
        if(phone.startsWith('01')) phone = '88' + phone;
        const formattedNumber = `${phone}@c.us`;

        try {
            const isRegistered = await client.isRegisteredUser(formattedNumber);
            res.json({ success: true, phone: phone, has_whatsapp: isRegistered });
        } catch (error) {
            res.status(500).json({ success: false, error: 'Failed to check number' });
        }
    });

    app.get('/', (req, res) => {
        res.send('WhatsApp API is running');
    });

    app.listen(port, () => {
        console.log(`Server is running on port ${port}`);
    });
}).catch(err => {
    console.log('MongoDB Connection Error:', err);
});