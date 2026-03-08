const express = require("express");
const cors = require("cors");
const QRCode = require("qrcode");
const { db } = require("./firebase");
const {
    collection,
    doc,
    setDoc,
    getDoc,
    addDoc,
    updateDoc,
    serverTimestamp,
} = require("firebase/firestore");

const app = express();
app.use(cors());
app.use(express.json());

// Utility: generate random ID
function generateId(prefix = "") {
    const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
    let result = "";
    for (let i = 0; i < 8; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return prefix ? `${prefix}_${result}` : result;
}

// POST /api/shop/login
app.post("/api/shop/login", async (req, res) => {
    try {
        const { name } = req.body;
        if (!name) return res.status(400).json({ error: "Shop name is required" });

        const shopID = generateId("shop");
        const umi_id = `shop_${generateId()}@umi`;

        await setDoc(doc(db, "shops", shopID), {
            name,
            umi_id,
            created_at: new Date().toISOString(),
        });

        res.json({ shopID, name, umi_id });
    } catch (err) {
        console.error("Login error:", err);
        res.status(500).json({ error: "Failed to create shop" });
    }
});

// POST /api/session/create
app.post("/api/session/create", async (req, res) => {
    try {
        const { shopID } = req.body;
        if (!shopID) return res.status(400).json({ error: "shopID is required" });

        const sessionID = generateId("sess");
        const createdAt = new Date();
        const expiryTime = new Date(createdAt.getTime() + 3 * 60 * 1000); // 3 minutes

        await setDoc(doc(db, "sessions", sessionID), {
            shopID,
            userID: null,
            createdAt: createdAt.toISOString(),
            expiryTime: expiryTime.toISOString(),
            status: "waiting",
        });

        // Generate QR code
        const qrData = `umi://shop/${shopID}/${sessionID}`;
        const qrDataUrl = await QRCode.toDataURL(qrData, {
            width: 300,
            margin: 2,
            color: { dark: "#0ff0fc", light: "#0a0f1a" },
        });

        res.json({ sessionID, qrDataUrl, qrData, createdAt, expiryTime });
    } catch (err) {
        console.error("Session create error:", err);
        res.status(500).json({ error: "Failed to create session" });
    }
});

// POST /api/message/send
app.post("/api/message/send", async (req, res) => {
    try {
        const { sessionID, sender, text } = req.body;
        if (!sessionID || !sender || !text) {
            return res.status(400).json({ error: "sessionID, sender, and text are required" });
        }

        const messageID = generateId("msg");
        await setDoc(doc(db, "messages", sessionID, "chat", messageID), {
            sender,
            text,
            timestamp: serverTimestamp(),
        });

        res.json({ messageID, success: true });
    } catch (err) {
        console.error("Message send error:", err);
        res.status(500).json({ error: "Failed to send message" });
    }
});

// POST /api/session/expire
app.post("/api/session/expire", async (req, res) => {
    try {
        const { sessionID } = req.body;
        const { updateDoc } = require("firebase/firestore");
        await updateDoc(doc(db, "sessions", sessionID), { status: "expired" });
        res.json({ success: true });
    } catch (err) {
        console.error("Session expire error:", err);
        res.status(500).json({ error: "Failed to expire session" });
    }
});

// POST /api/masked-number/create
app.post("/api/masked-number/create", async (req, res) => {
    try {
        const { umi_id, expiry } = req.body;
        const tokenID = generateId("mask");
        const masked_number = `+91 9${Math.floor(100 + Math.random() * 900)} ${Math.floor(100 + Math.random() * 900)} ${Math.floor(1000 + Math.random() * 9000)}`;

        await setDoc(doc(db, "masked_numbers", tokenID), {
            masked_number,
            umi_id,
            expiry,
        });

        res.json({ tokenID, masked_number });
    } catch (err) {
        console.error("Masked number error:", err);
        res.status(500).json({ error: "Failed to create masked number" });
    }
});

require("dotenv").config();
const { Resend } = require("resend");
const resend = new Resend(process.env.RESEND_API_KEY);

// POST /api/email/send
app.post("/api/email/send", async (req, res) => {
    try {
        const { sessionID, shopName, amount, contact } = req.body;

        if (!contact || !contact.includes("@")) {
            return res.status(400).json({ error: "Valid email address required" });
        }

        const { data, error } = await resend.emails.send({
            from: "UMI Delivery <onboarding@resend.dev>",
            to: [contact],
            subject: `Receipt from ${shopName}`,
            html: `
                <div style="font-family: sans-serif; padding: 20px; color: #333;">
                    <h2>Thank you for your visit!</h2>
                    <p>Here is your receipt from <strong>${shopName}</strong>.</p>
                    <div style="background-color: #f5f5f5; padding: 15px; border-radius: 8px; margin: 20px 0;">
                        <h1 style="color: #25D366; margin: 0;">₹${amount}</h1>
                    </div>
                </div>
            `,
        });

        if (error) {
            console.error("Resend error inside SDK:", error);
            return res.status(400).json({ error: error.message });
        }

        // Update Firestore session status
        await updateDoc(doc(db, "sessions", sessionID), { status: "delivered" });

        res.json({ success: true, id: data.id });
    } catch (err) {
        console.error("Email send error:", err);
        res.status(500).json({ error: "Failed to send email" });
    }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`🚀 UMI POS Server running on http://localhost:${PORT}`);
});
