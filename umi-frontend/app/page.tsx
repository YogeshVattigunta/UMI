"use client";
import React, { useState } from 'react';
import { Phone, ShieldAlert, ShieldCheck, Loader2 } from 'lucide-react';

export default function UmiDashboard() {
  const [numbers, setNumbers] = useState({ victim: '', scammer: '' });
  const [status, setStatus] = useState('Idle');
  const [loading, setLoading] = useState(false);

  const initiateCall = async () => {
    setLoading(true);
    setStatus('Connecting...');

    try {
      // Connect directly to local backend to bypass ngrok warning screen
      const BACKEND_URL = 'http://localhost:3001';

      const response = await fetch(`${BACKEND_URL}/api/make-call`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          victimNumber: numbers.victim,   // Key must match backend
          scammerNumber: numbers.scammer // Key must match backend
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setStatus('Monitoring Active');
      } else {
        throw new Error(data.error || 'Failed to start call');
      }
    } catch (err: any) {
      console.error("Connection Error:", err);
      setStatus('Error: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#020617] flex items-center justify-center p-4 text-slate-200">
      <div className="w-full max-w-md bg-[#0f172a] border border-slate-800 rounded-2xl p-8 shadow-2xl">
        <h1 className="text-2xl font-bold bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent mb-6">
          UMI Secure Call
        </h1>

        <div className="space-y-4">
          <div>
            <label className="text-xs text-slate-500 uppercase ml-1">Victim Number</label>
            <input
              placeholder="+91..."
              className="w-full bg-[#1e293b] p-3 rounded-lg border border-slate-700 outline-none focus:border-emerald-500"
              onChange={(e) => setNumbers({ ...numbers, victim: e.target.value })}
            />
          </div>
          <div>
            <label className="text-xs text-slate-500 uppercase ml-1">Scammer Number</label>
            <input
              placeholder="+91..."
              className="w-full bg-[#1e293b] p-3 rounded-lg border border-slate-700 outline-none focus:border-emerald-500"
              onChange={(e) => setNumbers({ ...numbers, scammer: e.target.value })}
            />
          </div>
          <button
            onClick={initiateCall}
            disabled={loading}
            className="w-full bg-emerald-600 hover:bg-emerald-500 p-4 rounded-xl font-bold flex justify-center gap-2 transition-all active:scale-95"
          >
            {loading ? <Loader2 className="animate-spin" /> : <ShieldCheck />}
            Initiate Monitored Call
          </button>
        </div>

        <div className="mt-8 p-4 border border-slate-800 rounded-xl text-center bg-[#0a0f1d]">
          <p className="text-[10px] text-slate-500 uppercase font-black tracking-widest">Status</p>
          <p className={`text-xl font-bold mt-1 ${status.includes('Error') ? 'text-red-500' : 'text-emerald-400'}`}>
            {status}
          </p>
        </div>
      </div>
    </div>
  );
}