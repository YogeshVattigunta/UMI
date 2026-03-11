import { useState, useEffect } from 'react';
import { db } from '../firebase';
import { doc, updateDoc, getDoc } from 'firebase/firestore';

export default function DeliveryPanel({ session, shop }) {
    const [amount, setAmount] = useState('');
    const [sendingChannel, setSendingChannel] = useState(null);
    const [successMsg, setSuccessMsg] = useState('');

    const isActive = session?.status === 'active';
    const isDelivered = session?.status === 'delivered';
    const isExpired = session?.status === 'expired';

    // Clear success message when session changes
    useEffect(() => {
        setSuccessMsg('');
    }, [session?.sessionID]);

    const sendBill = async (channel) => {
        if (!amount) return;

        setSendingChannel(channel);
        setSuccessMsg('');

        try {
            // Fetch user contact from Firestore
            let userContact = session.userID;
            try {
                const userSnap = await getDoc(doc(db, 'users', session.userID));
                if (userSnap.exists()) {
                    const userData = userSnap.data();
                    userContact = userData.phone || userData.umi_id || session.userID;
                }
            } catch (err) {
                console.error("Could not fetch user contact", err);
            }

            if (channel === 'email') {
                // Hardcoded email destination per requirements
                const emailAddress = 's95853214@gmail.com';

                // --- 1a. RESEND ROUTE (Backend API) ---
                const response = await fetch('http://localhost:5000/api/email/send', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        sessionID: session.sessionID,
                        shopName: shop.name,
                        amount: amount,
                        contact: emailAddress
                    })
                });

                const data = await response.json();
                if (!response.ok) throw new Error(data.error || 'Failed to send email');

                console.log("Email sent directly via Resend API", data);

            } else {
                // --- 1b. n8n WEBHOOK ROUTE (WhatsApp/Telegram) ---
                const payload = {
                    sessionId: session.sessionID,
                    shopName: shop.name,
                    amount: amount,
                    channel: channel,
                    contact: userContact
                };

                // Send webhook to n8n (no-cors mode bypasses browser blocking)
                await fetch(
                    "https://hackathon.app.n8n.cloud/webhook/send-bill",
                    {
                        method: "POST",
                        mode: "no-cors",
                        headers: {
                            "Content-Type": "application/json"
                        },
                        body: JSON.stringify(payload)
                    }
                );

                console.log(`Bill webhook triggered successfully for ${channel}`);
            }

            // 2. Update Firestore session status
            const sessionRef = doc(db, 'sessions', session.sessionID);
            await updateDoc(sessionRef, {
                status: 'delivered',
            });

            // 3. Show success message
            setSuccessMsg('Bill sent successfully.');
            setAmount('');

        } catch (error) {
            console.error('Error sending bill via webhook:', error);
            alert('Failed to send bill. Please try again.');
        } finally {
            setSendingChannel(null);
        }
    };

    const getStatusLabel = () => {
        if (!session) return null;
        if (isExpired) return <span className="status-badge expired">⚠ Expired</span>;
        if (isDelivered) return <span className="status-badge active">✓ Bill Delivered</span>;
        if (isActive) return <span className="status-badge active">● Customer Connected</span>;
        return <span className="status-badge waiting">◌ Waiting for Customer</span>;
    };

    return (
        <div className="panel chat-container">
            <div className="panel-header">
                <h3><span className="icon">🚀</span> Delivery Automation</h3>
            </div>

            {session && <div className="chat-status">{getStatusLabel()}</div>}

            <div className="panel-content" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                {!session ? (
                    <div className="chat-empty">
                        <div className="empty-icon">🚀</div>
                        <p>Start a session to connect<br />with a customer</p>
                    </div>
                ) : !isActive && !isDelivered ? (
                    <div className="chat-empty">
                        <div className="empty-icon">📱</div>
                        <p>Waiting for the customer to scan the QR code...</p>
                    </div>
                ) : (
                    <div className="animate-fadeInUp" style={{ padding: '10px' }}>
                        {successMsg ? (
                            <div className="session-expired-banner" style={{ backgroundColor: 'rgba(16, 185, 129, 0.1)', borderColor: 'rgba(16, 185, 129, 0.3)', color: 'var(--accent-green)' }}>
                                {successMsg}
                            </div>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                <div className="info-card">
                                    <div className="label" style={{ marginBottom: '12px' }}>Send Bill details</div>

                                    <div className="form-group" style={{ marginBottom: '24px' }}>
                                        <label>Bill Amount (₹)</label>
                                        <input
                                            type="number"
                                            placeholder="e.g. 450"
                                            value={amount}
                                            onChange={(e) => setAmount(e.target.value)}
                                            min="1"
                                            required
                                        />
                                    </div>

                                    <div className="label" style={{ marginBottom: '12px' }}>Delivery Options</div>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                        <button
                                            onClick={() => sendBill('whatsapp')}
                                            className="btn-primary"
                                            disabled={sendingChannel !== null || !amount}
                                            style={{ width: '100%', background: 'linear-gradient(135deg, #25D366 0%, #128C7E 100%)', color: 'white' }}
                                        >
                                            {sendingChannel === 'whatsapp' ? '⏳ Sending...' : '💬 Send via WhatsApp'}
                                        </button>

                                        <button
                                            onClick={() => sendBill('telegram')}
                                            className="btn-primary"
                                            disabled={sendingChannel !== null || !amount}
                                            style={{ width: '100%', background: 'linear-gradient(135deg, #0088cc 0%, #005580 100%)', color: 'white' }}
                                        >
                                            {sendingChannel === 'telegram' ? '⏳ Sending...' : '✈️ Send via Telegram'}
                                        </button>

                                        <button
                                            onClick={() => sendBill('email')}
                                            className="btn-primary"
                                            disabled={sendingChannel !== null || !amount}
                                            style={{ width: '100%', background: 'linear-gradient(135deg, #ea4335 0%, #c5221f 100%)', color: 'white' }}
                                        >
                                            {sendingChannel === 'email' ? '⏳ Sending...' : '📧 Send via Email'}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
