const express = require('express');
const { Client, RemoteAuth } = require('whatsapp-web.js');
const { MongoStore } = require('wwebjs-mongo');
const mongoose = require('mongoose');
const qrcode = require('qrcode-terminal');

const app = express();
const port = process.env.PORT || 3000;

// আপনার দেওয়া MongoDB কানেকশন স্ট্রিংটি এখানে বসানো হয়েছে
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://rakibbfadu_db_user:Woirfl3WQh6DFAUp@cluster0.g9ciz0r.mongodb.net/?appName=Cluster0';

app.use(express.json());

mongoose.connect(MONGODB_URI).then(() => {
    console.log('MongoDB Connected successfully!');
    const store = new MongoStore({ mongoose: mongoose });

    const client = new Client({
        authStrategy: new RemoteAuth({
            store: store,
            backupSyncIntervalMs: 300000
        }),
        puppeteer: {
            args: ['--no-sandbox', '--disable-setuid-sandbox'],
            executablePath: process.env.NODE_ENV === 'production' 
                ? '/usr/bin/google-chrome' 
                : undefined 
        }
    });

    client.on('qr', (qr) => {
        qrcode.generate(qr, { small: true });
        console.log('আপনার ফোনের WhatsApp থেকে এই QR Code টি স্ক্যান করুন!');
    });

    client.on('ready', () => {
        console.log('WhatsApp Client is ready!');
    });

    client.on('remote_session_saved', () => {
        console.log('Session successfully saved to MongoDB');
    });

    client.initialize();

    // নম্বর চেক করার API
    app.get('/check-number/:phone', async (req, res) => {
        let phone = req.params.phone;
        if(phone.startsWith('01')) {
            phone = '88' + phone;
        }
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