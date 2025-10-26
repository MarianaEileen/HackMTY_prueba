import { Component, ChangeDetectionStrategy, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { GeminiService, ForecastResponse } from '../../services/gemini.service';
import { FlightContextService } from '../../services/flight-context.service';

@Component({
  selector: 'app-consumption-prediction',
  imports: [CommonModule, FormsModule],
  templateUrl: './consumption-prediction.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ConsumptionPredictionComponent {
  private geminiService = inject(GeminiService);
  // Inject the shared flight context service and make it public for template binding
  flightContextService = inject(FlightContextService);

  predictionResult = signal<ForecastResponse | null>(null);
  isLoading = signal(false);
  error = signal<string | null>(null);

  async getPrediction() {
    this.isLoading.set(true);
    this.error.set(null);
    this.predictionResult.set(null);
    try {
      // Use the flight data from the shared service for the prediction
      const result = await this.geminiService.getConsumptionPrediction(this.flightContextService.flightData());
      this.predictionResult.set(result);
    } catch (e) {
      this.error.set('Failed to fetch prediction. The AI model may have returned an invalid format.');
      console.error(e);
    } finally {
      this.isLoading.set(false);
    }
  }
}