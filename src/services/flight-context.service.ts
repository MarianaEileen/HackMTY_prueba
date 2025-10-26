import { Injectable, signal } from '@angular/core';
import { FlightData } from './gemini.service';

@Injectable({
  providedIn: 'root'
})
export class FlightContextService {
  // Signal to hold the current flight data, shared across the application.
  // It's initialized with default values for a typical international flight.
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
}
