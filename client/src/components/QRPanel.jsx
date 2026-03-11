import { useState, useEffect } from 'react';

const API = 'http://localhost:5000/api';

export default function QRPanel({ shopID, session, onSessionCreated }) {
    const [qrData, setQrData] = useState(null);
    const [loading, setLoading] = useState(false);
    const [timeLeft, setTimeLeft] = useState(null);

    // Countdown timer
    useEffect(() => {
        if (!session?.expiryTime) {
            setTimeLeft(null);
            return;
        }

        const tick = () => {
            const diff = new Date(session.expiryTime) - new Date();
            if (diff <= 0) {
                setTimeLeft(0);
            } else {
                setTimeLeft(Math.ceil(diff / 1000));
            }
        };

        tick();
        const interval = setInterval(tick, 1000);
        return () => clearInterval(interval);
    }, [session?.expiryTime]);

    const createSession = async () => {
        setLoading(true);
        try {
            const res = await fetch(`${API}/session/create`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ shopID }),
            });
            const data = await res.json();
            setQrData(data);
            onSessionCreated(data);
        } catch (err) {
            console.error('Session create error:', err);
        } finally {
            setLoading(false);
        }
    };

    const formatTimer = (seconds) => {
        if (seconds === null) return '--:--';
        const m = Math.floor(seconds / 60);
        const s = seconds % 60;
        return `${m}:${s.toString().padStart(2, '0')}`;
    };

    const getTimerClass = () => {
        if (timeLeft === null) return 'timer-value';
        if (timeLeft <= 30) return 'timer-value critical';
        if (timeLeft <= 60) return 'timer-value warning';
        return 'timer-value';
    };

    const isExpired = session?.status === 'expired' || timeLeft === 0;
    const hasActiveSession = session && !isExpired;

    return (
        <div className="panel">
            <div className="panel-header">
                <h3><span className="icon">📱</span> QR Session</h3>
            </div>
            <div className="panel-content">
                <div className="qr-section">
                    <button
                        className="btn-session"
                        onClick={createSession}
                        disabled={loading || hasActiveSession}
                    >
                        {loading ? '⏳ Creating...' : hasActiveSession ? '✓ Session Active' : '⚡ Start Customer Session'}
                    </button>

                    {qrData && !isExpired && (
                        <div className="qr-display">
                            <div className="qr-image-container">
                                <img src={qrData.qrDataUrl} alt="Session QR Code" />
                            </div>

                            <div className="qr-label">Scan URI</div>
                            <div className="qr-uri">{qrData.qrData}</div>

                            <div className="timer-display">
                                <div className="timer-label">Session Expires In</div>
                                <div className={getTimerClass()}>
                                    {formatTimer(timeLeft)}
                                </div>
                            </div>
                        </div>
                    )}

                    {isExpired && session && (
                        <div style={{ marginTop: 20 }}>
                            <div className="session-expired-banner">
                                ⏰ Session expired. Start a new session.
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
