import { GoogleGenAI } from "@google/genai";

// Initialize Gemini Client
// IMPORTANT: In a real production app, never expose API keys on the client.
// This is for demonstration using the provided environment variable pattern.
const apiKey = process.env.API_KEY || ''; 
const ai = new GoogleGenAI({ apiKey });

export const getBaristaRoast = async (score: number, coffeeCount: number): Promise<string> => {
  if (!apiKey) {
    return "Don't cry over spilt milk. (Add API Key for a real roast!)";
  }

  try {
    const prompt = `
      You are a snarky, pretentious high-end coffee shop barista. 
      A player just received a "Game Over" in a coffee-run game because they hit a carton of milk.
      They scored ${score} points and collected ${coffeeCount} cups of espresso.
      
      Give them a short, witty, 1-sentence roast about their performance. 
      Make a pun about milk, caffeine, or coffee beans if possible.
      Be mean but funny.
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });

    return response.text?.trim() || "You've been decaffeinated.";
  } catch (error) {
    console.error("Gemini Roast Error:", error);
    return "The barista is too busy judging your order to roast you right now.";
  }
};
