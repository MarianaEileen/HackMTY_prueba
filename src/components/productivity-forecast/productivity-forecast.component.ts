
import { Component, ChangeDetectionStrategy, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { GeminiService } from '../../services/gemini.service';

@Component({
  selector: 'app-productivity-forecast',
  imports: [CommonModule, FormsModule],
  templateUrl: './productivity-forecast.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProductivityForecastComponent {
  private geminiService = inject(GeminiService);

  trolleyItems = signal('');
  forecastResult = signal<string | null>(null);
  isLoading = signal(false);
  error = signal<string | null>(null);

  async getForecast() {
    if (!this.trolleyItems().trim()) {
      this.error.set('Please enter a list of items.');
      return;
    }

    this.isLoading.set(true);
    this.error.set(null);
    this.forecastResult.set(null);
    
    try {
      const result = await this.geminiService.getProductivityForecast(this.trolleyItems());
      this.forecastResult.set(result);
    } catch (e) {
      this.error.set('Failed to fetch forecast.');
      console.error(e);
    } finally {
      this.isLoading.set(false);
    }
  }
}
