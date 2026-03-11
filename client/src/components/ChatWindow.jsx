import { useState, useEffect, useRef } from 'react';
import { db } from '../firebase';
import {
    collection,
    query,
    where,
    onSnapshot,
    orderBy,
} from 'firebase/firestore';

const API = 'http://localhost:5000/api';

export default function ChatWindow({ session, shopID }) {
    const [messages, setMessages] = useState([]);
    const [input, setInput] = useState('');
    const [sending, setSending] = useState(false);
    const messagesEndRef = useRef(null);

    const isActive = session?.status === 'active';
    const isExpired = session?.status === 'expired';
    const canChat = isActive && !isExpired;

    // Listen for messages in real-time
    useEffect(() => {
        if (!session?.sessionID) {
            setMessages([]);
            return;
        }

        const q = query(
            collection(db, `messages/${session.sessionID}/chat`),
            orderBy('timestamp', 'asc')
        );

        const unsub = onSnapshot(q, (snap) => {
            const msgs = snap.docs
                .map((doc) => ({ id: doc.id, ...doc.data() }))
                .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
            setMessages(msgs);
        });

        return () => unsub();
    }, [session?.sessionID]);

    // Auto-scroll
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const sendMessage = async (text) => {
        if (!text.trim() || !canChat) return;
        setSending(true);

        try {
            await fetch(`${API}/message/send`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    sessionID: session.sessionID,
                    sender: 'shop',
                    text: text.trim(),
                }),
            });
            setInput('');
        } catch (err) {
            console.error('Send error:', err);
        } finally {
            setSending(false);
        }
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        sendMessage(input);
    };

    const getStatusLabel = () => {
        if (!session) return null;
        if (isExpired) return <span className="status-badge expired">⚠ Expired</span>;
        if (isActive) return <span className="status-badge active">● Live Session</span>;
        return <span className="status-badge waiting">◌ Waiting for Customer</span>;
    };

    const formatTime = (ts) => {
        if (!ts) return '';
        const d = new Date(ts);
        return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    };

    return (
        <div className="panel chat-container">
            <div className="panel-header">
                <h3><span className="icon">💬</span> Messages</h3>
            </div>

            {session && <div className="chat-status">{getStatusLabel()}</div>}

            <div className="chat-messages">
                {!session ? (
                    <div className="chat-empty">
                        <div className="empty-icon">💬</div>
                        <p>Start a session to begin chatting<br />with your customer</p>
                    </div>
                ) : messages.length === 0 ? (
                    <div className="chat-empty">
                        <div className="empty-icon">📱</div>
                        <p>
                            {isActive
                                ? 'Customer connected! Send a message.'
                                : 'Waiting for the customer to scan the QR code...'}
                        </p>
                    </div>
                ) : (
                    messages.map((msg) => (
                        <div key={msg.id} className={`message ${msg.sender}`}>
                            <div className={`message-bubble ${msg.text.startsWith('Your bill amount') ? 'bill' : ''}`}>
                                <div>{msg.text}</div>
                                <div className="message-time">{formatTime(msg.timestamp)}</div>
                            </div>
                        </div>
                    ))
                )}
                <div ref={messagesEndRef} />
            </div>

            <form className="chat-input-area" onSubmit={handleSubmit}>
                <input
                    type="text"
                    placeholder={canChat ? 'Type a message...' : 'Chat disabled'}
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    disabled={!canChat || sending}
                />
                <button type="submit" className="btn-send" disabled={!canChat || !input.trim() || sending}>
                    Send
                </button>
            </form>
        </div>
    );
}
