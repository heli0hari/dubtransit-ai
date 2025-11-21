import { GoogleGenAI, Type } from "@google/genai";
import { JourneyPlan, ServiceAlert, AlertSeverity, AlertCategory } from "../types";
import { SYSTEM_INSTRUCTION_JOURNEY } from "../constants";

// ✅ Correct way to read Vite env variables
const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY;

// Helpful dev-time check
if (!GEMINI_API_KEY) {
  throw new Error(
    "❌ Missing VITE_GEMINI_API_KEY. Add it to your .env.local and to Netlify environment variables."
  );
}

// Initialize Gemini client
const ai = new GoogleGenAI({
  apiKey: GEMINI_API_KEY
});


// -------------------------------------------------------
// 📌 1. Journey Planner
// -------------------------------------------------------
export const getJourneyPlan = async (
  origin: string,
  destination: string
): Promise<JourneyPlan | null> => {
  try {
    const prompt = `Plan a journey from "${origin}" to "${destination}" in Dublin using public transport.`;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        systemInstruction: SYSTEM_INSTRUCTION_JOURNEY,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            summary: { type: Type.STRING },
            totalDuration: { type: Type.STRING },
            steps: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  instruction: { type: Type.STRING },
                  duration: { type: Type.STRING },
                  mode: {
                    type: Type.STRING,
                    enum: ["BUS", "LUAS", "DART", "WALK"],
                  },
                },
              },
            },
          },
        },
      },
    });

    const jsonText = response.text;
    if (!jsonText) return null;

    return JSON.parse(jsonText) as JourneyPlan;
  } catch (error) {
    console.error("❌ Error planning journey:", error);
    return null;
  }
};


// -------------------------------------------------------
// 📌 2. Alerts Generator (Simulated)
// -------------------------------------------------------
export const generateSimulatedAlerts = async (): Promise<ServiceAlert[]> => {
  try {
    const prompt =
      "Generate 3 realistic, simulated public transport alerts for Dublin right now. Mix of delays, planned works, or route diversions. Use real locations such as Heuston, O'Connell St, Ranelagh, etc. Include category (GENERAL, EVENT, ACCIDENT, WEATHER).";

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              alert_id: { type: Type.STRING },
              title: { type: Type.STRING },
              description: { type: Type.STRING },
              severity: {
                type: Type.STRING,
                enum: ["LOW", "MEDIUM", "HIGH"],
              },
              category: {
                type: Type.STRING,
                enum: ["GENERAL", "EVENT", "ACCIDENT", "WEATHER"],
              },
              routes: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
              },
              timestamp: { type: Type.INTEGER },
            },
          },
        },
      },
    });

    const jsonText = response.text;
    if (!jsonText) return [];

    const rawData = JSON.parse(jsonText);

    return rawData.map((alert: any) => ({
      alert_id: alert.alert_id || Math.random().toString(36).substring(2),
      title: alert.title,
      description: alert.description,
      severity: alert.severity as AlertSeverity,
      category: (alert.category as AlertCategory) || "GENERAL",
      routes: alert.routes || [],
      stops: [],
      timestamp: alert.timestamp || Math.floor(Date.now() / 1000),
    }));
  } catch (error) {
    console.error("❌ Error generating alerts:", error);
    return [];
  }
};


// -------------------------------------------------------
// 📌 3. Geolocation Search
// -------------------------------------------------------
export const searchLocation = async (
  query: string
): Promise<{ lat: number; lon: number; name: string } | null> => {
  try {
    const prompt = `Find the latitude and longitude for "${query}" in Dublin, Ireland. If ambiguous, assume Dublin city centre.`;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            lat: { type: Type.NUMBER },
            lon: { type: Type.NUMBER },
            name: { type: Type.STRING },
          },
        },
      },
    });

    const jsonText = response.text;
    if (!jsonText) return null;

    return JSON.parse(jsonText);
  } catch (error) {
    console.error("❌ Error searching location:", error);
    return null;
  }
};
