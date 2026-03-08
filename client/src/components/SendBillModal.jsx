import { useState } from 'react';

export default function SendBillModal({ onSend, onClose }) {
    const [amount, setAmount] = useState('');

    const handleSubmit = (e) => {
        e.preventDefault();
        if (!amount || isNaN(amount) || Number(amount) <= 0) return;
        onSend(`Your bill amount is ₹${Number(amount).toLocaleString('en-IN')}`);
        onClose();
    };

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-card" onClick={(e) => e.stopPropagation()}>
                <h3>💵 Send Bill</h3>
                <p className="modal-subtitle">Enter the bill amount to send to the customer</p>

                <form onSubmit={handleSubmit}>
                    <div className="form-group">
                        <label>Amount (₹)</label>
                        <input
                            type="number"
                            placeholder="e.g. 450"
                            value={amount}
                            onChange={(e) => setAmount(e.target.value)}
                            autoFocus
                            min="1"
                            step="0.01"
                        />
                    </div>

                    {amount && Number(amount) > 0 && (
                        <div className="bill-preview">
                            Your bill amount is ₹{Number(amount).toLocaleString('en-IN')}
                        </div>
                    )}

                    <div className="modal-actions">
                        <button type="button" className="btn-cancel" onClick={onClose}>
                            Cancel
                        </button>
                        <button type="submit" className="btn-confirm" disabled={!amount || Number(amount) <= 0}>
                            Send Bill
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
