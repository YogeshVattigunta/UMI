import React, { useState } from 'react';
import { Phone, ShieldAlert, ShieldCheck, Loader2 } from 'lucide-react';

const UMISecureCall = () => {
  const [numbers, setNumbers] = useState({ caller: '', target: '' });
  const [status, setStatus] = useState('Idle'); // Idle, Monitoring, Alert
  const [analysis, setAnalysis] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleInitiateCall = async () => {
    setLoading(true);
    setStatus('Monitoring');
    
    // Logic to trigger your Llama-3.1-8b-instant API would go here
    // For now, we simulate a response
    setTimeout(() => {
      const mockResponse = { threat_level: "High", reason: "Social Engineering" };
      setAnalysis(mockResponse);
      setStatus('Alert');
      setLoading(false);
    }, 2000);
  };

  return (
    <div className="min-h-screen bg-[#020617] flex items-center justify-center p-4 font-sans text-slate-200">
      <div className="w-full max-w-md bg-[#0f172a] border border-slate-800 rounded-2xl p-8 shadow-2xl">
        
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent">
            UMI Secure Call
          </h1>
          <p className="text-slate-400 text-sm mt-1">Real-time edge AI threat detection.</p>
        </div>

        {/* Input Fields */}
        <div className="space-y-6">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">
              Your Phone Number
            </label>
            <div className="relative">
              <Phone className="absolute left-3 top-3 w-5 h-5 text-slate-500" />
              <input 
                type="text"
                placeholder="+1 234 567 890"
                className="w-full bg-[#1e293b] border border-slate-700 rounded-lg py-3 pl-11 pr-4 focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 outline-none transition-all"
                onChange={(e) => setNumbers({...numbers, caller: e.target.value})}
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">
              Target Phone Number
            </label>
            <div className="relative">
              <Phone className="absolute left-3 top-3 w-5 h-5 text-slate-500" />
              <input 
                type="text"
                placeholder="+1 987 654 321"
                className="w-full bg-[#1e293b] border border-slate-700 rounded-lg py-3 pl-11 pr-4 focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 outline-none transition-all"
                onChange={(e) => setNumbers({...numbers, target: e.target.value})}
              />
            </div>
          </div>

          <button 
            onClick={handleInitiateCall}
            disabled={loading}
            className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:bg-emerald-800 text-white font-bold py-4 rounded-xl shadow-lg shadow-emerald-900/20 flex items-center justify-center gap-2 transition-all active:scale-95"
          >
            {loading ? <Loader2 className="animate-spin" /> : <ShieldCheck className="w-5 h-5" />}
            Initiate Monitored Call
          </button>
        </div>

        {/* Dynamic Status Section */}
        <div className="mt-8 pt-8 border-t border-slate-800">
          <div className={`rounded-xl p-4 border transition-colors ${
            status === 'Alert' ? 'bg-red-950/30 border-red-900/50' : 'bg-slate-900/50 border-slate-800'
          }`}>
            <div className="flex flex-col items-center text-center">
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 mb-1">Status</p>
              
              <div className="flex items-center gap-2">
                {status === 'Alert' && <ShieldAlert className="w-5 h-5 text-red-500 animate-pulse" />}
                <p className={`text-2xl font-bold ${
                  status === 'Alert' ? 'text-red-500' : 'text-slate-300'
                }`}>
                  {status}
                </p>
              </div>

              {analysis && (
                <div className="mt-3">
                  <p className="text-sm text-slate-400">
                    <span className="text-red-400 font-semibold">Threat:</span> {analysis.reason}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default UMISecureCall;