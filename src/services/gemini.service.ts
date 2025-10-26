
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

  async getConsumptionPrediction(data: FlightData): Promise<string> {
    if (!this.genAI) {
      return Promise.resolve("Gemini AI client is not initialized. Check API Key.");
    }

    const prompt = `
      As an AI for Gate Group airline catering, forecast the consumption of the top 5 products based on this flight data:
      - Flight Type: ${data.type}
      - Route: ${data.origin} to ${data.destination}
      - Aircraft: ${data.aircraft}
      - Season: ${data.season}
      - Temperature at Origin: ${data.temperature}°C
      - Duration: ${data.duration} hours
      - Passengers: ${data.passengers}
      
      Provide the prediction as a simple, unnumbered list with product names and estimated quantities (e.g., 'Chicken Pasta: 80 units').
    `;
    
    try {
      const response: GenerateContentResponse = await this.genAI.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt
      });
      return response.text.trim();
    } catch (error) {
      console.error('Error getting consumption prediction:', error);
      return 'An error occurred while generating the prediction.';
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
}
