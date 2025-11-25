import { GoogleGenAI } from "@google/genai";

// Declare process for client-side usage in Vite (polyfilled by define)
declare const process: any;

// Initialize Gemini Client
// IMPORTANT: In a real production app, never expose API keys on the client.
// This is for demonstration using the provided environment variable pattern.
const apiKey = process.env.API_KEY || ''; 
const ai = new GoogleGenAI({ apiKey });

export const getBaristaRoast = async (score: number, coffeeCount: number): Promise<string> => {
  if (!apiKey) {
    return "Ekki gráta yfir helltri mjólk. (Vantar API lykil fyrir alvöru roast!)";
  }

  try {
    const prompt = `
      Þú ert hrokafullur íslenskur kaffibarþjónn á dýru kaffihúsi í Reykjavík (eins og Reykjavik Roasters eða Te og Kaffi).
      Leikmaður var að tapa í kaffileik af því hann klessti á mjólkurfernu.
      Hann náði ${score} stigum og safnaði ${coffeeCount} espresso bollum.
      
      Gefðu honum stutt, fyndið og hrokafullt 1-setningar "roast" á íslensku um frammistöðuna.
      Notaðu orðaleik um mjólk, kaffi, kaffibaunir eða íslenska kaffimenningu ef hægt er.
      Vertu vond/ur en fyndin/n.
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });

    return response.text?.trim() || "Þú hefur verið afkaffínvædd/ur.";
  } catch (error) {
    console.error("Gemini Roast Error:", error);
    return "Barþjónninn er of upptekinn við að dæma pöntunina þína.";
  }
};