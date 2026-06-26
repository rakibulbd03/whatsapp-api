const express = require('express');
const { Client, RemoteAuth } = require('whatsapp-web.js');
const { MongoStore } = require('wwebjs-mongo');
const mongoose = require('mongoose');
const qrcode = require('qrcode-terminal');

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
        qrcode.generate(qr, { small: true }); 
        console.log('QR Code রেডি! ব্রাউজারে /qr লিংকে গিয়ে স্ক্যান করুন।');
    });

    client.on('ready', () => {
        console.log('WhatsApp Client is ready!');
        qrCodeData = ''; // কানেক্ট হলে কোড মুছে ফেলবে
    });

    client.on('remote_session_saved', () => {
        console.log('Session successfully saved to MongoDB');
    });

    client.initialize();

    // ওয়েবপেজে ফ্রেশ QR কোড দেখানোর আপডেট API
    app.get('/qr', (req, res) => {
        res.setHeader('Content-Type', 'text/html');
        if (qrCodeData) {
            // 외부 API দিয়ে সরাসরি ইমেজ জেনারেট করা হচ্ছে
            const qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(qrCodeData)}`;
            res.send(`
                
                
                    
                        WhatsApp QR
                        
                        
                    
                    
                        
                            WhatsApp Connection
                            আপনার ফোনের WhatsApp দিয়ে নিচের QR কোডটি স্ক্যান করুন
                            
                        
                    
                
            `);
        } else {
            res.send(`
                
                
                    
                        Status
                        
                    
                    
                        QR Code এখনও তৈরি হয়নি বা ইতিমধ্যে স্ক্যান হয়ে গেছে!
                        Render এর লগ (Logs) চেক করুন অথবা পেজটি কিছুক্ষণ পর রিলোড (Refresh) করুন।
                    
                
            `);
        }
    });

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