import { Component, ChangeDetectionStrategy, signal, inject, ViewChild, ElementRef, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FlightContextService } from '../../services/flight-context.service';
import { BrowserMultiFormatReader } from '@zxing/library';
import { IScannerControls } from '@zxing/browser';

// Define an interface for the tracked QR object
interface TrackedQR {
  text: string;
  location: {
    topLeft: { x: number; y: number };
    topRight: { x: number; y: number };
    bottomLeft: { x: number; y: number };
    bottomRight: { x: number; y: number };
  };
  status: 'good' | 'warning' | 'expired';
  lastSeen: number;
}

// Interface for the overlay data used for rendering
interface QrOverlay {
  points: { x: number; y: number }[];
  color: string;
}

@Component({
  selector: 'app-expiry-scanner',
  imports: [CommonModule],
  templateUrl: './expiry-scanner.component.html', // Use the external template
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ExpiryScannerComponent implements OnDestroy {
  // Inject services
  private flightContextService = inject(FlightContextService);

  // ViewChild elements for video and canvas
  @ViewChild('videoEl') videoEl!: ElementRef<HTMLVideoElement>;
  @ViewChild('canvasEl') canvasEl!: ElementRef<HTMLCanvasElement>;

  // Component state signals
  isScanning = signal(false);
  error = signal<string | null>(null);

  // Private properties for scanner logic
  private reader = new BrowserMultiFormatReader();
  private controls: IScannerControls | null = null;
  private activeQr = signal<TrackedQR | null>(null);
  private overlay = signal<QrOverlay | null>(null);
  private animationFrameId: number | null = null;
  private stream: MediaStream | null = null;

  // Lifecycle hook for cleanup
  ngOnDestroy(): void {
    this.stopScan();
  }

  async startScan(): Promise<void> {
    if (this.isScanning() || !this.videoEl) {
      return;
    }

    try {
      this.error.set(null);
      this.isScanning.set(true);
      const videoElement = this.videoEl.nativeElement;
      
      this.stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      videoElement.srcObject = this.stream;
      videoElement.play(); // Explicitly play the video for better browser compatibility

      // Start decoding from the video stream
      this.controls = await this.reader.decodeFromStream(this.stream, videoElement, (result, err) => {
        if (result) {
          const qrData = this.processQrCode(result.getText());
          if (qrData) {
             const resultPoints = result.getResultPoints();
             if (resultPoints.length >= 3) {
                 this.activeQr.set({
                    text: result.getText(),
                    location: {
                        bottomLeft: resultPoints[0],
                        topLeft: resultPoints[1],
                        topRight: resultPoints[2],
                        // Handle cases where only 3 points are detected
                        bottomRight: resultPoints[3] || resultPoints[0], 
                    },
                    status: qrData.status,
                    lastSeen: Date.now(),
                });
             }
          }
        }
        // We don't need to handle NotFoundException here as it's not a terminal error
      });

      // Start the drawing loop
      this.animationFrameId = requestAnimationFrame(() => this.drawLoop());

    } catch (e: any) {
      console.error('Error starting scanner:', e);
      let message = 'Could not start the camera.';
      if (e.name === 'NotAllowedError') {
        message = 'Camera access was denied. Please allow camera permission in your browser settings.';
      } else if (e.name === 'NotFoundError') {
        message = 'No camera found on this device.';
      }
      this.error.set(message);
      this.isScanning.set(false);
    }
  }

  stopScan(): void {
    if (this.controls) {
      this.controls.stop();
      this.controls = null;
    }
    if(this.stream) {
        this.stream.getTracks().forEach(track => track.stop());
        this.stream = null;
    }
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
    this.isScanning.set(false);
    this.activeQr.set(null);
    this.overlay.set(null);
    
    const canvas = this.canvasEl?.nativeElement;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
    }
  }

  private drawLoop(): void {
    const canvas = this.canvasEl.nativeElement;
    const video = this.videoEl.nativeElement;
    const ctx = canvas.getContext('2d');

    if (!ctx || !this.isScanning()) {
      return;
    }

    if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
    }

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const currentQr = this.activeQr();
    if (currentQr) {
      if (Date.now() - currentQr.lastSeen > 300) {
        this.activeQr.set(null);
        this.overlay.set(null);
      } else {
        const newOverlay = this.createOverlay(currentQr);
        
        const oldOverlay = this.overlay();
        if (oldOverlay && oldOverlay.points.length === newOverlay.points.length) {
            newOverlay.points.forEach((point, i) => {
                point.x = this.lerp(oldOverlay.points[i].x, point.x, 0.3);
                point.y = this.lerp(oldOverlay.points[i].y, point.y, 0.3);
            });
        }
        this.overlay.set(newOverlay);
      }
    }

    const currentOverlay = this.overlay();
    if (currentOverlay) {
        this.drawPolygon(ctx, currentOverlay.points, currentOverlay.color);
    }
    
    this.animationFrameId = requestAnimationFrame(() => this.drawLoop());
  }
  
  private createOverlay(qr: TrackedQR): QrOverlay {
    const colorMap = {
      good: 'rgba(34, 197, 94, 0.7)',    // green-500
      warning: 'rgba(234, 179, 8, 0.7)',   // yellow-500
      expired: 'rgba(239, 68, 68, 0.7)', // red-500
    };
    
    return {
        points: [
            qr.location.topLeft,
            qr.location.topRight,
            qr.location.bottomRight,
            qr.location.bottomLeft,
        ],
        color: colorMap[qr.status]
    };
  }

  private drawPolygon(ctx: CanvasRenderingContext2D, points: {x:number, y:number}[], color: string) {
    if (points.length < 3) return;
    
    ctx.lineWidth = 6;
    ctx.strokeStyle = color;
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) {
        ctx.lineTo(points[i].x, points[i].y);
    }
    ctx.closePath();
    ctx.stroke();
  }
  
  private lerp(start: number, end: number, amt: number): number {
    return (1 - amt) * start + amt * end;
  }

  private processQrCode(qrText: string): { status: 'good' | 'warning' | 'expired' } | null {
    try {
      let expiryDateStr: string | null = null;
      try {
        const data = JSON.parse(qrText);
        expiryDateStr = data.expiry || data.expiryDate || data.exp || null;
      } catch (e) {
        if (/^\d{4}-\d{2}-\d{2}$/.test(qrText)) {
            expiryDateStr = qrText;
        }
      }

      if (!expiryDateStr) return null;

      const expiryDate = new Date(expiryDateStr);
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const diffTime = expiryDate.getTime() - today.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      
      const status = this.checkProductStatus(diffDays);
      return { status };

    } catch (e) {
      console.error("Invalid QR code data format", e);
      return null;
    }
  }

  private checkProductStatus(daysUntilExpiry: number): 'good' | 'warning' | 'expired' {
    const flightData = this.flightContextService.flightData();
    let warningThreshold = 5; // Default for domestic

    if (flightData.type === 'International') {
      const isLongHaul = ['Boeing 777', 'Airbus A350', 'Boeing 787', '777', 'A350', '787'].some(plane => flightData.aircraft.includes(plane));
      warningThreshold = isLongHaul ? 14 : 10;
    }

    if (daysUntilExpiry < 0) {
      return 'expired';
    }
    if (daysUntilExpiry <= warningThreshold) {
      return 'warning';
    }
    return 'good';
  }
}