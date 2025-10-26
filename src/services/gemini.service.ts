import { Injectable, signal } from '@angular/core';
import { GoogleGenAI, GenerateContentResponse } from "@google/genai";

export interface FlightData {
  type: string;
  origin: string;
  destination: string;
  aircraft: string;
  season: string;
  temperature: number;
  duration: number;
  passengers: number;
}

export interface Recommendation {
  item: string;
  quantity: number;
  reason: string;
}

export interface ForecastResponse {
  route: string;
  flight_type: string;
  season: string;
  temperature: number;
  passengers: number;
  recommendations: Recommendation[];
  safety_buffer_policy: string;
}


@Injectable({
  providedIn: 'root'
})
export class GeminiService {
  private genAI: GoogleGenAI | null = null;
  
  constructor() {
    // IMPORTANT: This relies on `process.env.API_KEY` being set in the environment.
    // In a real application, this should be handled securely.
    try {
        this.genAI = new GoogleGenAI({ apiKey: process.env.API_KEY });
    } catch (e) {
        console.error("API Key not found or invalid. Please set process.env.API_KEY.", e);
    }
  }

  async getConsumptionPrediction(data: FlightData): Promise<ForecastResponse> {
    if (!this.genAI) {
      throw new Error("Gemini AI client is not initialized. Check API Key.");
    }
    
    let flightType: 'Short' | 'Medium' | 'Long';
    if (data.duration < 3) {
      flightType = 'Short';
    } else if (data.duration <= 6) {
      flightType = 'Medium';
    } else {
      flightType = 'Long';
    }

    const prompt = `
You are an expert in inflight logistics and catering optimization for Gate Group.
Your task is to predict what items, and how many units of each, should be packed into the airplane trolley
for an upcoming flight.

### Context
Gate Group operates inflight catering for multiple airlines. Each flight requires precise planning of meal,
snack, and beverage quantities based on:
- Origin and destination airport
- Number of passengers
- Flight duration
- Flight type (Short / Medium / Long haul)
- Season
- Temperature (average at origin/destination)
- Historical consumption patterns (sales, leftovers, and lost sales)
- Item category (main dish, dessert, beverage, snack, etc.)

You have extensive knowledge of historical consumption behavior in similar routes.

When asked, you must:
1. **Estimate per-item quantities** to be loaded in the trolley.
2. **Adjust recommendations** based on flight conditions (temperature, passengers, flight type, and season).
3. **Explain briefly the reasoning** (e.g., “more cold drinks in summer”, “short flights require fewer snacks”, etc.).
4. **Output data** in a structured, app-friendly JSON format.

### Inputs (you will be given these in each request)
- ORIGIN: ${data.origin}
- DESTINY: ${data.destination}
- PASSENGERS: ${data.passengers}
- FLIGHT_TYPE: ${flightType}
- SEASON: ${data.season}
- TEMPERATURE: ${data.temperature}
- SPECIAL_NOTES: ""

### Forecasting logic to follow
1. Start with a **base consumption rate** for each category:
   - Main meals: ~1.0 per passenger (adjust if multiple options)
   - Snacks: 0.8 per passenger on medium/long flights
   - Cold beverages: 1.5 per passenger in summer / hot weather
   - Hot beverages: 0.7 per passenger in winter / morning flights
   - Desserts: 0.6 per passenger average
   - Special meals (vegetarian, gluten-free, etc.): 5–10% of total meals
2. Adjust using contextual multipliers:
   - Temperature > 25°C → +30% cold drinks, -20% hot drinks
   - Flight_Type = Long → +15% snacks, +10% desserts
   - Flight_Type = Short → -20% snacks, -10% desserts
   - Season = Summer → +25% cold drinks, +10% light meals
   - Season = Winter → +20% hot drinks, +5% heavy meals
   - Night flight → +10% hot beverages, -15% cold beverages
3. Add a **safety buffer** of +1.65 × (expected standard deviation)
   - If historical data unavailable, apply a +10% buffer for variability and lost sales.
4. Return **integer rounded values** (ceil to next unit).

### Output format
Return the forecast as a JSON object with the following structure:

{
  "route": "MEX-JFK",
  "flight_type": "Long",
  "season": "Winter",
  "temperature": 8,
  "passengers": 210,
  "recommendations": [
    {"item": "Chicken Meal", "quantity": 115, "reason": "Main hot meal; 55% expected choice"},
    {"item": "Vegetarian Wrap", "quantity": 25, "reason": "10% of passengers choose vegetarian"},
    {"item": "Dessert Brownie", "quantity": 120, "reason": "Slightly higher demand on long flights"},
    {"item": "Soft Drinks (assorted)", "quantity": 320, "reason": "Cold weather; normal rate"},
    {"item": "Hot Coffee", "quantity": 180, "reason": "Winter season, morning flight"},
    {"item": "Snack Mix", "quantity": 160, "reason": "Midflight demand and buffer included"}
  ],
  "safety_buffer_policy": "10% buffer for uncertainty"
}

### Notes
- Always ensure the sum of recommended meals ≈ passenger count.
- Always ensure drink totals > passenger count (average passenger consumes >1 drink).
- Always include at least one vegetarian option.
- Include reasoning so the logistics planner can justify the forecast.

Now, generate the forecast for this flight.
`;
    
    try {
      const response: GenerateContentResponse = await this.genAI.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
        }
      });
      const cleanedText = response.text.replace(/```json/g, '').replace(/```/g, '').trim();
      return JSON.parse(cleanedText) as ForecastResponse;
    } catch (error) {
      console.error('Error getting consumption prediction:', error);
      throw new Error('An error occurred while generating the prediction.');
    }
  }

  async getProductivityForecast(trolleyItems: string): Promise<string> {
    if (!this.genAI) {
        return Promise.resolve("Gemini AI client is not initialized. Check API Key.");
    }
    const prompt = `
      As an expert in airline catering logistics for Gate Group, estimate the assembly time in minutes for a catering trolley containing the following items:
      ${trolleyItems}
      
      Your estimation is based on a sophisticated hybrid architecture of Gradient Boosting, implemented with LightGBM.
      Provide only the estimated time in minutes. Example response: '18 minutes'
    `;

    try {
      const response: GenerateContentResponse = await this.genAI.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt
      });
      return response.text.trim();
    } catch (error) {
      console.error('Error getting productivity forecast:', error);
      return 'An error occurred while generating the forecast.';
    }
  }

  // Add new method to scan expiry dates from images
  async scanExpiryDate(base64Image: string, mimeType: string): Promise<string> {
    if (!this.genAI) {
      return Promise.resolve("Gemini AI client is not initialized. Check API Key.");
    }

    const imagePart = {
      inlineData: {
        mimeType: mimeType,
        data: base64Image,
      },
    };

    const textPart = {
      text: "Read the expiry date from this image. Provide only the date in YYYY-MM-DD format. If no date is found, respond with 'N/A'."
    };

    try {
      const response: GenerateContentResponse = await this.genAI.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: { parts: [imagePart, textPart] }
      });
      return response.text.trim();
    } catch (error) {
      console.error('Error scanning expiry date:', error);
      return 'An error occurred while scanning the image.';
    }
  }
}