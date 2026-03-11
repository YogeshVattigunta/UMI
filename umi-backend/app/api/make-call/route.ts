import { NextResponse } from "next/server";
import Groq from "groq-sdk";

// Initialize the Groq client with your API Key
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

export async function POST(request: Request) {
  try {
    const { callerNumber, targetNumber } = await request.json();

    if (!callerNumber || !targetNumber) {
      return NextResponse.json({ error: "Both numbers are required" }, { status: 400 });
    }

    // This is where you'd trigger your calling service (like Twilio).
    // For now, we simulate the AI analyzing the call transcript.
    const chatCompletion = await groq.chat.completions.create({
      messages: [
        {
          role: "system",
          content: "You are a security AI. Analyze the transcript for threats and return JSON: {threat_level: 'High'|'Low', reason: 'string'}"
        },
        {
          role: "user",
          content: "Simulate analysis for a call between " + callerNumber + " and " + targetNumber
        }
      ],
      model: "llama-3.1-8b-instant",
      response_format: { type: "json_object" } // Use JSON mode for structured output
    });

    const aiResponse = JSON.parse(chatCompletion.choices[0].message.content || "{}");

    return NextResponse.json({
      success: true,
      caller: callerNumber,
      target: targetNumber,
      analysis: aiResponse
    });

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}