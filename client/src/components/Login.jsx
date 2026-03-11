import { useState } from 'react';

const API = 'http://localhost:5000/api';

export default function Login({ onLogin }) {
    const [name, setName] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!name.trim()) return;
        setLoading(true);

        try {
            const res = await fetch(`${API}/shop/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: name.trim() }),
            });
            const data = await res.json();
            if (data.shopID) {
                onLogin(data);
            }
        } catch (err) {
            console.error('Login error:', err);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="login-page">
            <div className="login-container">
                <div className="login-brand">
                    <div className="logo-icon">⚡</div>
                    <h1>UMI</h1>
                    <p>Point of Sale Terminal</p>
                </div>

                <div className="login-card">
                    <h2>Shop Login</h2>
                    <p className="subtitle">Enter your shop name to start a POS session</p>

                    <form onSubmit={handleSubmit}>
                        <div className="form-group">
                            <label>Shop Name</label>
                            <input
                                type="text"
                                placeholder="e.g. Alpha Electronics"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                autoFocus
                            />
                        </div>
                        <button type="submit" className="btn-primary" disabled={loading || !name.trim()}>
                            {loading ? '⏳ Creating Shop...' : '🚀 Launch POS Dashboard'}
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
}
