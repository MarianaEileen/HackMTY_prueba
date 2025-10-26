
import { Component, ChangeDetectionStrategy, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { GeminiService, FlightData } from '../../services/gemini.service';

@Component({
  selector: 'app-consumption-prediction',
  imports: [CommonModule, FormsModule],
  templateUrl: './consumption-prediction.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ConsumptionPredictionComponent {
  private geminiService = inject(GeminiService);

  flightData = signal<FlightData>({
    type: 'International',
    origin: 'JFK',
    destination: 'LHR',
    aircraft: 'Boeing 777',
    season: 'Summer',
    temperature: 25,
    duration: 7,
    passengers: 250
  });

  predictionResult = signal<string[]>([]);
  isLoading = signal(false);
  error = signal<string | null>(null);

  async getPrediction() {
    this.isLoading.set(true);
    this.error.set(null);
    this.predictionResult.set([]);
    try {
      const resultText = await this.geminiService.getConsumptionPrediction(this.flightData());
      this.predictionResult.set(resultText.split('\n').filter(line => line.trim() !== ''));
    } catch (e) {
      this.error.set('Failed to fetch prediction.');
      console.error(e);
    } finally {
      this.isLoading.set(false);
    }
  }
}
