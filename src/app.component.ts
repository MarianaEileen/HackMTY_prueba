
import { Component, ChangeDetectionStrategy, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ConsumptionPredictionComponent } from './components/consumption-prediction/consumption-prediction.component';
import { ExpiryScannerComponent } from './components/expiry-scanner/expiry-scanner.component';
import { ProductivityForecastComponent } from './components/productivity-forecast/productivity-forecast.component';

type ActiveView = 'prediction' | 'scanner' | 'productivity';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    ConsumptionPredictionComponent,
    ExpiryScannerComponent,
    ProductivityForecastComponent
  ],
})
export class AppComponent {
  activeView = signal<ActiveView>('prediction');

  setView(view: ActiveView) {
    this.activeView.set(view);
  }
}
