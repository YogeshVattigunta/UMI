import express from 'express';
import { WebSocketServer, WebSocket } from 'ws';
import http from 'http';
import twilio from 'twilio';
import Groq from 'groq-sdk';
import dotenv from 'dotenv';
import cors from 'cors';

dotenv.config();

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cors({
    origin: '*', // Or explicitly specify your Next.js localhost port e.g., 'http://localhost:3000'
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'ngrok-skip-browser-warning']
}));


app.use((req, res, next) => {
    res.setHeader('ngrok-skip-browser-warning', 'true');
    next();
});

const twilioClient = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

const BASE_URL = `https://${process.env.NGROK_DOMAIN.replace(/\/+$/, '')}`;
console.log('BASE_URL:', BASE_URL);

const rooms = {};
const streamAttached = new Set();

// ─────────────────────────────────────────────
// MAKE CALL
// ─────────────────────────────────────────────
app.post('/api/make-call', async (req, res) => {
    const { victimNumber, scammerNumber } = req.body;
    const roomName = `umi_${Date.now()}`;

    rooms[roomName] = {
        victimSid: null,
        scammerSid: null,
        participantCount: 0,
        conferenceSid: null,
        scammerConferenceSid: null,
        victimConferenceSid: null
    };

    try {
        const [victimCall, scammerCall] = await Promise.all([
            twilioClient.calls.create({
                to: victimNumber,
                from: process.env.TWILIO_PHONE_NUMBER,
                // ✅ role passed as separate path segments, no & in URL
                url: `${BASE_URL}/twiml-victim/${roomName}`
            }),
            twilioClient.calls.create({
                to: scammerNumber,
                from: process.env.TWILIO_PHONE_NUMBER,
                url: `${BASE_URL}/twiml-scammer/${roomName}`
            })
        ]);

        rooms[roomName].victimSid = victimCall.sid;
        rooms[roomName].scammerSid = scammerCall.sid;

        console.log('Room:', roomName);
        console.log('Victim SID:', victimCall.sid);
        console.log('Scammer SID:', scammerCall.sid);

        res.json({ success: true, room: roomName });
    } catch (error) {
        delete rooms[roomName];
        console.error('Call error:', error.message);
        res.status(500).json({ error: error.message });
    }
});

// ─────────────────────────────────────────────
// TWIML — separate routes for each role, no & in callback URL
// ─────────────────────────────────────────────
app.post('/twiml-victim/:room', (req, res) => {
    const { room } = req.params;
    console.log(`twiml-victim room=${room}`);

    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Dial>
    <Conference beep="false"
                startConferenceOnEnter="true"
                endConferenceOnExit="true"
                statusCallbackEvent="join leave"
                statusCallback="${BASE_URL}/conference-event/${room}"
                statusCallbackMethod="POST"
    >${room}</Conference>
  </Dial>
</Response>`;
    res.type('text/xml').send(twiml);
});

app.post('/twiml-scammer/:room', (req, res) => {
    const { room } = req.params;
    console.log(`twiml-scammer room=${room}`);

    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Dial>
    <Conference beep="false"
                startConferenceOnEnter="true"
                endConferenceOnExit="false"
                statusCallbackEvent="join leave"
                statusCallback="${BASE_URL}/conference-event/${room}"
                statusCallbackMethod="POST"
    >${room}</Conference>
  </Dial>
</Response>`;
    res.type('text/xml').send(twiml);
});

// ─────────────────────────────────────────────
// CONFERENCE EVENTS — single endpoint per room
// ─────────────────────────────────────────────
app.post('/conference-event/:room', async (req, res) => {
    const { room } = req.params;
    const { CallSid, ConferenceSid, StatusCallbackEvent } = req.body;
    console.log(`[CONFERENCE] Event: ${StatusCallbackEvent} | CallSid=${CallSid} | Room=${room}`);

    if (!rooms[room]) {
        console.log(`⚠️ Room not found: ${room}`);
        return res.sendStatus(200);
    }

    if (StatusCallbackEvent === 'participant-join') {
        rooms[room].conferenceSid = ConferenceSid;
        rooms[room].participantCount++;

        if (CallSid === rooms[room].scammerSid) {
            rooms[room].scammerConferenceSid = CallSid;
            console.log(`Room ${room}: scammer joined (${rooms[room].participantCount}/2)`);
        } else if (CallSid === rooms[room].victimSid) {
            rooms[room].victimConferenceSid = CallSid;
            console.log(`Room ${room}: victim joined (${rooms[room].participantCount}/2)`);
        } else {
            console.log(`Room ${room}: unknown participant joined (${rooms[room].participantCount}/2)`);
        }

        await tryAttachStream(room);
    }

    if (StatusCallbackEvent === 'participant-leave') {
        rooms[room].participantCount = Math.max(0, rooms[room].participantCount - 1);

        if (CallSid === rooms[room].scammerSid) {
            console.log(`Room ${room}: scammer left`);
        } else if (CallSid === rooms[room].victimSid) {
            console.log(`Room ${room}: victim left`);
        } else {
            console.log(`Room ${room}: unknown participant left`);
        }
    }

    res.sendStatus(200);
});

// ✅ Attach stream once both are in
async function tryAttachStream(room) {
    const r = rooms[room];
    if (!r || r.participantCount < 2) return;
    const scammerSid = r.scammerConferenceSid;
    if (!scammerSid || streamAttached.has(scammerSid)) return;

    streamAttached.add(scammerSid);
    try {
        await twilioClient.calls(scammerSid).streams.create({
            url: `${BASE_URL.replace('https://', 'wss://')}/stream`,
            track: 'inbound_track' // Only capture scammer's voice
        });
        console.log('✅ Stream attached to scammer:', scammerSid);
    } catch (e) {
        console.error('❌ Stream attach error:', e.message);
        streamAttached.delete(scammerSid);
    }
}

// ─────────────────────────────────────────────
// WEBSOCKET — Audio → Deepgram → Groq
// ─────────────────────────────────────────────
wss.on('connection', (ws, req) => {
    if (req.url !== '/stream') return;
    console.log('✅ WebSocket connected');

    let callSid = '';
    let transcriptBuffer = '';

    const deepgramWs = new WebSocket(
        [
            'wss://api.deepgram.com/v1/listen',
            '?model=nova-2-phonecall',
            '&encoding=mulaw',
            '&sample_rate=8000',
            '&channels=1',
            '&interim_results=true',
            '&endpointing=200',
            '&smart_format=true'
        ].join(''),
        { headers: { Authorization: `Token ${process.env.DEEPGRAM_API_KEY}` } }
    );

    deepgramWs.on('open', () => {
        console.log('✅ Deepgram WebSocket opened');
        const keepAlive = setInterval(() => {
            if (deepgramWs.readyState === WebSocket.OPEN) {
                deepgramWs.send(JSON.stringify({ type: 'KeepAlive' }));
            } else {
                clearInterval(keepAlive);
            }
        }, 8000);
        deepgramWs.on('close', (code, reason) => {
            clearInterval(keepAlive);
            console.log(`Deepgram closed: code=${code} reason=${reason}`);
        });
    });

    deepgramWs.on('error', e => console.error('❌ Deepgram error:', e.message));

    ws.on('message', (message) => {
        const msg = JSON.parse(message);

        if (msg.event === 'start') {
            callSid = msg.start.callSid;
            console.log('✅ Stream started, callSid:', callSid);
            console.log('   Stream tracks:', JSON.stringify(msg.start.tracks));
        }

        if (msg.event === 'media') {
            if (msg.media.track === 'inbound' || msg.media.track === undefined) {
                if (deepgramWs.readyState === WebSocket.OPEN) {
                    deepgramWs.send(Buffer.from(msg.media.payload, 'base64'));
                }
            }
        }

        if (msg.event === 'stop') {
            console.log('Stream stop event received');
        }
    });

    deepgramWs.on('message', async (data) => {
        const result = JSON.parse(data);

        // Log ALL deepgram messages for debugging
        if (result.type === 'Results') {
            const isSpeechFinal = result.speech_final;
            const isFinal = result.is_final;
            const text = result.channel?.alternatives?.[0]?.transcript;
            const confidence = result.channel?.alternatives?.[0]?.confidence;

            if (text && text.trim()) {
                console.log(`[DEEPGRAM] is_final=${isFinal} speech_final=${isSpeechFinal} confidence=${confidence} text="${text}"`);

                if (isFinal || isSpeechFinal) {
                    transcriptBuffer += text + ' ';
                    console.log(`[BUFFER] "${transcriptBuffer.trim()}" (${transcriptBuffer.length} chars)`);

                    if (isSpeechFinal || transcriptBuffer.length > 30) {
                        const toAnalyze = transcriptBuffer.trim();
                        transcriptBuffer = '';
                        analyzeForScam(toAnalyze, callSid)
                            .catch(e => console.error('Analyze error:', e.message));
                    }
                } else {
                    process.stdout.write(`\r[interim] ${text}                    `);
                }
            }
        } else if (result.type === 'SpeechStarted') {
            console.log('[DEEPGRAM] Speech started detected');
        } else if (result.type === 'UtteranceEnd') {
            console.log('[DEEPGRAM] Utterance end detected');
        } else {
            console.log('[DEEPGRAM RAW]', JSON.stringify(result).substring(0, 100));
        }
    });

    ws.on('close', () => {
        console.log('\nWebSocket closed for:', callSid);
        if (deepgramWs.readyState === WebSocket.OPEN) deepgramWs.close();
    });

    ws.on('error', e => console.error('WS error:', e.message));
});

// ─────────────────────────────────────────────
// SCAM DETECTION
// ─────────────────────────────────────────────
async function analyzeForScam(text, callSid) {
    try {
        console.log('[ANALYZING]', text);

        const completion = await groq.chat.completions.create({
            messages: [
                {
                    role: 'system',
                    content: `You are a scam detection AI. Analyze the transcript.
Return ONLY JSON: {"scam": true/false, "reason": "string", "confidence": "high/medium/low"}
Flag as scam if: OTP/PIN requested, money transfer, bank/govt impersonation, urgency tactics, gift cards.`
                },
                { role: 'user', content: text }
            ],
            model: 'llama-3.3-70b-versatile',
            response_format: { type: 'json_object' },
            max_tokens: 100
        });

        const result = JSON.parse(completion.choices[0].message.content);
        console.log('[SCAM RESULT]', JSON.stringify(result));

        if (result.scam && result.confidence !== 'low') {
            console.log('🚨 SCAM DETECTED');

            const roomEntry = Object.values(rooms).find(r => r.scammerConferenceSid === callSid);

            if (roomEntry?.conferenceSid) {
                const victimSid = roomEntry.victimConferenceSid;
                const scammerSid = callSid;

                // Step 1: Remove scammer from conference
                try {
                    await twilioClient.conferences(roomEntry.conferenceSid)
                        .participants(scammerSid).remove();
                    console.log('✅ Scammer removed from conference');
                } catch (e) { console.error('Remove error:', e.message); }

                // Step 2: Warn and hang up scammer
                try {
                    await twilioClient.calls(scammerSid).update({
                        twiml: `<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Say voice="Polly.Matthew">
        Stop right there. You are under digital arrest and your fraud has been caught. Authorities have been notified.
    </Say>
    <Hangup/>
</Response>`
                    });
                    console.log('✅ Scammer warned and disconnected');
                } catch (e) { }

                // Step 3: Warn victim
                if (victimSid) {
                    try {
                        await twilioClient.calls(victimSid).update({
                            twiml: `<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Say voice="Polly.Joanna">
        Alert. UMI Secure has detected that this was a spam call.
        The caller has been disconnected. You are now safe.
    </Say>
    <Hangup/>
</Response>`
                        });
                        console.log('✅ Spam warning played to victim');
                    } catch (e) {
                        console.error('Victim update error:', e.message);
                    }
                }
            } else {
                try {
                    await twilioClient.calls(callSid).update({
                        twiml: `<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Say voice="Polly.Matthew">
        Stop right there. You are under digital arrest and your fraud has been caught. Authorities have been notified.
    </Say>
    <Hangup/>
</Response>`
                    });
                } catch (e) { }
            }
        } else {
            console.log('[NOT SCAM]', result.reason);
        }
    } catch (e) {
        console.error('❌ analyzeForScam error:', e.message);
    }
}

server.listen(3001, () => console.log('🚀 UMI Secure server on port 3001'));