const { default: makeWASocket, DisconnectReason, BufferJSON, initAuthCreds } = require('@whiskeysockets/baileys');
const pino = require('pino');
const mongoose = require('mongoose');
const express = require('express');
const cors = require('cors'); // <-- ব্রাউজার সিকিউরিটি ফিক্স করার জন্য এটি যুক্ত করা হলো

const app = express();
const port = process.env.PORT || 3000;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://rakibbfadu_db_user:Woirfl3WQh6DFAUp@cluster0.g9ciz0r.mongodb.net/?appName=Cluster0';

app.use(cors()); // <-- লারাভেল সাইটকে পারমিশন দেওয়ার জন্য এটি যুক্ত করা হলো
app.use(express.json());

let sock = null;
let qrCodeData = '';
let isClientReady = false;

// MongoDB তে Baileys এর সেশন সেভ করার জন্য স্কিমা
const authSchema = new mongoose.Schema({
    id: { type: String, required: true, unique: true },
    data: { type: String, required: true }
});
const AuthModel = mongoose.model('BaileysAuth', authSchema);

// কাস্টম MongoDB অথেন্টিকেশন স্টোরেজ ফাংশন
async function useMongoDBAuthState() {
    let creds;
    const credsDoc = await AuthModel.findOne({ id: 'baileys_creds' });
    
    if (credsDoc) {
        creds = JSON.parse(credsDoc.data, BufferJSON.reviver);
    } else {
        creds = initAuthCreds();
    }

    return {
        state: {
            creds,
            keys: {
                get: async (type, ids) => {
                    const data = {};
                    for (const id of ids) {
                        const doc = await AuthModel.findOne({ id: `baileys_${type}-${id}` });
                        if (doc) {
                            data[id] = JSON.parse(doc.data, BufferJSON.reviver);
                        }
                    }
                    return data;
                },
                set: async (data) => {
                    for (const type in data) {
                        for (const id in data[type]) {
                            const val = data[type][id];
                            const key = `baileys_${type}-${id}`;
                            if (val) {
                                await AuthModel.findOneAndUpdate(
                                    { id: key },
                                    { data: JSON.stringify(val, BufferJSON.replacer) },
                                    { upsert: true }
                                );
                            } else {
                                await AuthModel.deleteOne({ id: key });
                            }
                        }
                    }
                }
            }
        },
        saveCreds: async () => {
            await AuthModel.findOneAndUpdate(
                { id: 'baileys_creds' },
                { data: JSON.stringify(creds, BufferJSON.replacer) },
                { upsert: true }
            );
        }
    };
}

// হোয়াটসঅ্যাপ কানেকশন মেইন ফাংশন
async function connectToWhatsApp() {
    console.log('Connecting to WhatsApp via Baileys...');
    const { state, saveCreds } = await useMongoDBAuthState();

    sock = makeWASocket({
        auth: state,
        printQRInTerminal: true,
        logger: pino({ level: 'silent' }), // বাড়তি লগ বন্ধ করে র‍্যাম বাঁচাবে
        browser: ['Khulna Design & Print', 'Chrome', '1.0.0']
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect, qr } = update;
        
        if (qr) {
            qrCodeData = qr;
            console.log('New QR Code Text Ready! Go to /qr to copy it.');
        }

        if (connection === 'close') {
            isClientReady = false;
            const shouldReconnect = lastDisconnect.error?.output?.statusCode !== DisconnectReason.loggedOut;
            console.log('Connection closed due to ', lastDisconnect.error, ', reconnecting: ', shouldReconnect);
            if (shouldReconnect) {
                connectToWhatsApp();
            }
        } else if (connection === 'open') {
            qrCodeData = '';
            isClientReady = true;
            console.log('WhatsApp Client is ready! (Baileys Version)');
        }
    });
}

// জাদুকরী টেক্সট কিউআর রাউট
app.get('/qr', (req, res) => {
    res.setHeader('Content-Type', 'text/html');
    if (qrCodeData) {
        res.send(`
            <div style="max-width: 800px; margin: 50px auto; font-family: Arial; text-align: center; background: #f9f9f9; padding: 30px; border-radius: 10px; box-shadow: 0 4px 10px rgba(0,0,0,0.1);">
                <h2 style="color: #d93025;">धাপ ১: নিচের বক্সের টেক্সটটি কপি করুন</h2>
                <textarea style="width: 100%; height: 150px; font-size: 14px; padding: 10px; border: 2px solid #ccc; border-radius: 5px;" onclick="this.select()">${qrCodeData}</textarea>
                <h2 style="color: #1a73e8; margin-top: 30px;">ধাপ ২: কিউআর জেনারেট করে স্ক্যান করুন</h2>
                <p style="font-size: 16px;">এবার <a href="https://www.the-qrcode-generator.com/" target="_blank" style="color: white; background: #1a73e8; padding: 10px 20px; text-decoration: none; border-radius: 5px; font-weight: bold;">এখানে ক্লিক করে</a> QR Generator সাইটে যান।</p>
                <p>সেখানে <b>Free Text</b> অপশনে এটি পেস্ট করে ডানপাশের QR কোডটি স্ক্যান করুন!</p>
            </div>
        `);
    } else if (isClientReady) {
        res.send('<h2 style="text-align:center; padding-top: 50px; font-family: Arial; color: green;">WhatsApp ইতিমধ্যে সফলভাবে কানেক্ট হয়ে আছে!</h2>');
    } else {
        res.send('<h2 style="text-align:center; padding-top: 50px; font-family: Arial;">QR Code এখনও তৈরি হয়নি, পেজটি কিছুক্ষণ পর রিফ্রেশ করুন।</h2>');
    }
});

// নম্বর চেক করার মেইন API (লারাভেলের জন্য)
app.get('/check-number/:phone', async (req, res) => {
    if (!isClientReady || !sock) {
        return res.json({ success: false, error: 'সার্ভার এখনও রেডি হয়নি! লগে "WhatsApp Client is ready!" আসা পর্যন্ত অপেক্ষা করুন।' });
    }

    let phone = req.params.phone.replace(/[^0-9]/g, '');
    if (phone.startsWith('01')) {
        phone = '88' + phone;
    }

    try {
        // Baileys এর নিজস্ব নম্বর ট্র্যাকিং মেথড
        const [result] = await sock.onWhatsApp(phone);
        if (result && result.exists) {
            res.json({ success: true, phone: phone, has_whatsapp: true });
        } else {
            res.json({ success: true, phone: phone, has_whatsapp: false });
        }
    } catch (error) {
        res.json({ success: false, error: 'API Error: ' + error.message });
    }
});

app.get('/', (req, res) => {
    res.send('Baileys WhatsApp API is running smoothly.');
});

// ডাটাবেজ কানেক্ট করে এক্সপ্রেস সার্ভার এবং হোয়াটসঅ্যাপ রান করা
mongoose.connect(MONGODB_URI).then(() => {
    console.log('MongoDB Connected successfully!');
    app.listen(port, () => {
        console.log(`Server is running on port ${port}`);
        connectToWhatsApp();
    });
}).catch(err => {
    console.log('MongoDB Connection Error:', err);
});