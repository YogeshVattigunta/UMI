export default function SessionPanel({ session, maskedNumber }) {
    if (!session) {
        return (
            <div className="panel">
                <div className="panel-header">
                    <h3><span className="icon">📋</span> Session Info</h3>
                </div>
                <div className="panel-content">
                    <div className="no-session">
                        <div className="empty-icon">📋</div>
                        <p>No active session.<br />Start one from the QR panel.</p>
                    </div>
                </div>
            </div>
        );
    }

    const isActive = session.status === 'active';
    const isExpired = session.status === 'expired';

    return (
        <div className="panel">
            <div className="panel-header">
                <h3><span className="icon">📋</span> Session Info</h3>
            </div>
            <div className="panel-content">
                <div className="session-info animate-slideInRight">
                    <div className="info-card">
                        <div className="label">Session ID</div>
                        <div className="value">{session.sessionID}</div>
                    </div>

                    <div className="info-card">
                        <div className="label">Status</div>
                        <div className="value">
                            <span className={`status-badge ${session.status}`}>
                                {session.status === 'waiting' && '◌ Waiting'}
                                {session.status === 'active' && '● Active'}
                                {session.status === 'expired' && '⚠ Expired'}
                            </span>
                        </div>
                    </div>

                    <div className="info-card">
                        <div className="label">Created At</div>
                        <div className="value">
                            {new Date(session.createdAt).toLocaleTimeString()}
                        </div>
                    </div>

                    <div className="info-card">
                        <div className="label">Expires At</div>
                        <div className="value">
                            {new Date(session.expiryTime).toLocaleTimeString()}
                        </div>
                    </div>

                    {session.userID && (
                        <div className="info-card">
                            <div className="label">Connected User</div>
                            <div className="value highlight">{session.userID}</div>
                        </div>
                    )}

                    {maskedNumber && isActive && (
                        <div className="info-card masked-number-card">
                            <div className="label">Customer Contact (Temporary)</div>
                            <div className="value">{maskedNumber}</div>
                        </div>
                    )}

                    {isExpired && (
                        <div className="session-expired-banner">
                            ⏰ Session expired.<br />Please start a new session.
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
