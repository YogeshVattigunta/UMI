import { useState, useEffect, useRef } from 'react';
import { db } from '../firebase';
import { doc, onSnapshot } from 'firebase/firestore';
import QRPanel from './QRPanel';
import DeliveryPanel from './DeliveryPanel';
import SessionPanel from './SessionPanel';

const API = 'http://localhost:5000/api';

export default function Dashboard({ shop, onLogout }) {
    // Keep sessionID separate so the listener doesn't re-fire on every session update
    const [activeSessionID, setActiveSessionID] = useState(null);
    const [session, setSession] = useState(null);
    const [maskedNumber, setMaskedNumber] = useState(null);
    const maskedGenerated = useRef(false);

    // ─── Firestore Realtime Listener ───────────────────────────
    // This runs ONCE per sessionID and stays subscribed continuously.
    useEffect(() => {
        if (!activeSessionID) return;

        console.log('📡 Setting up Firestore listener for:', activeSessionID);
        maskedGenerated.current = false;

        const sessionRef = doc(db, 'sessions', activeSessionID);

        const unsubscribe = onSnapshot(sessionRef, (snapshot) => {
            if (!snapshot.exists()) {
                console.log('❌ Session document does not exist');
                return;
            }

            const data = snapshot.data();
            console.log('🔄 Firestore session update:', JSON.stringify(data));

            // Update session state with Firestore data
            setSession((prev) => ({
                ...prev,
                ...data,
                sessionID: activeSessionID,
            }));

            // Detect user connection
            if (data.userID && data.status === 'active') {
                console.log('✅ User connected! userID:', data.userID);

                if (!maskedGenerated.current) {
                    maskedGenerated.current = true;
                    generateMaskedNumber(data);
                }
            }
        }, (error) => {
            console.error('❌ Firestore listener error:', error);
        });

        // Cleanup: unsubscribe when sessionID changes
        return () => {
            console.log('🔌 Unsubscribing from session:', activeSessionID);
            unsubscribe();
        };
    }, [activeSessionID]);
    // ───────────────────────────────────────────────────────────

    // ─── Auto-expire session ───────────────────────────────────
    useEffect(() => {
        if (!session?.expiryTime || session?.status === 'expired') return;

        const checkExpiry = () => {
            const diff = new Date(session.expiryTime) - new Date();
            if (diff <= 0 && session.status !== 'expired') {
                expireSession();
            }
        };

        const interval = setInterval(checkExpiry, 1000);
        return () => clearInterval(interval);
    }, [session?.expiryTime, session?.status]);

    // ─── API Calls ─────────────────────────────────────────────
    const generateMaskedNumber = async (sessionData) => {
        try {
            const res = await fetch(`${API}/masked-number/create`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    umi_id: shop.umi_id,
                    expiry: sessionData.expiryTime,
                }),
            });
            const data = await res.json();
            console.log('📞 Masked number created:', data.masked_number);
            setMaskedNumber(data.masked_number);
        } catch (err) {
            console.error('Masked number error:', err);
        }
    };

    const expireSession = async () => {
        if (!activeSessionID) return;
        try {
            await fetch(`${API}/session/expire`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ sessionID: activeSessionID }),
            });
            setSession((prev) => (prev ? { ...prev, status: 'expired' } : prev));
        } catch (err) {
            console.error('Expire error:', err);
        }
    };

    // ─── Session Lifecycle ─────────────────────────────────────
    const handleSessionCreated = (data) => {
        console.log('🆕 Session created:', data.sessionID);

        // Set session state first
        setSession({
            sessionID: data.sessionID,
            shopID: shop.shopID,
            createdAt: data.createdAt,
            expiryTime: data.expiryTime,
            status: 'waiting',
            userID: null,
        });
        setMaskedNumber(null);

        // Then activate the listener (separate state = stable dependency)
        setActiveSessionID(data.sessionID);
    };

    const handleNewSession = () => {
        setActiveSessionID(null);
        setSession(null);
        setMaskedNumber(null);
    };

    // ─── Render ────────────────────────────────────────────────
    return (
        <div className="dashboard">
            {/* Header */}
            <div className="dashboard-header">
                <div className="header-left">
                    <div className="header-logo">⚡</div>
                    <span className="header-title">UMI POS</span>
                </div>
                <div className="header-right">
                    <div className="shop-badge">
                        <span className="dot"></span>
                        <span>{shop.name}</span>
                    </div>

                    {session?.status === 'expired' && (
                        <button
                            className="btn-session"
                            style={{ padding: '8px 16px', fontSize: '12px', width: 'auto' }}
                            onClick={handleNewSession}
                        >
                            🔄 New Session
                        </button>
                    )}

                    <button className="btn-logout" onClick={onLogout}>
                        Logout
                    </button>
                </div>
            </div>

            {/* Body: 3-panel layout */}
            <div className="dashboard-body">
                <QRPanel
                    shopID={shop.shopID}
                    session={session}
                    onSessionCreated={handleSessionCreated}
                />

                <DeliveryPanel session={session} shop={shop} />

                <SessionPanel session={session} maskedNumber={maskedNumber} />
            </div>
        </div>
    );
}
