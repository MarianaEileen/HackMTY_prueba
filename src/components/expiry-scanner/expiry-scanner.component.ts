import { Component, ChangeDetectionStrategy, signal, OnDestroy, AfterViewInit, ViewChild, ElementRef, NgZone, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FlightContextService } from '../../services/flight-context.service';

declare var jsQR: any;

interface ProductData {
  productId: string;
  name: string;
  expiryDate: string;
}

type ProductStatus = 'ok' | 'nearing_expiry' | 'expired' | 'invalid' | null;

@Component({
  selector: 'app-expiry-scanner',
  imports: [CommonModule],
  templateUrl: './expiry-scanner.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ExpiryScannerComponent implements AfterViewInit, OnDestroy {
  @ViewChild('video') video!: ElementRef<HTMLVideoElement>;
  @ViewChild('canvas') canvas!: ElementRef<HTMLCanvasElement>;

  isScanning = signal(false);
  scanResult = signal<ProductData | null>(null);
  productStatus = signal<ProductStatus>(null);
  scanError = signal<string | null>(null);
  
  private stream: MediaStream | null = null;
  private animationFrameId: number | null = null;
  private flightContextService = inject(FlightContextService);

  constructor(private ngZone: NgZone) {}

  ngAfterViewInit() {
    // Component is now ready to start scanning
  }

  async startScan() {
    this.scanError.set(null);
    this.scanResult.set(null);
    this.productStatus.set(null);

    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      try {
        this.stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' }
        });
        this.isScanning.set(true);
        this.video.nativeElement.srcObject = this.stream;
        this.video.nativeElement.play();
        this.ngZone.runOutsideAngular(() => {
            this.animationFrameId = requestAnimationFrame(() => this.tick());
        });
      } catch (err) {
        console.error("Error accessing camera: ", err);
        this.scanError.set('Could not access camera. Please grant permission.');
        this.isScanning.set(false);
      }
    } else {
        this.scanError.set('Camera not supported by this browser.');
    }
  }

  stopScan() {
    this.isScanning.set(false);
    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
    }
    if (this.animationFrameId) {
        cancelAnimationFrame(this.animationFrameId);
    }
  }

  tick() {
    if (this.video.nativeElement.readyState === this.video.nativeElement.HAVE_ENOUGH_DATA) {
      const canvasElement = this.canvas.nativeElement;
      const context = canvasElement.getContext('2d');
      if(context){
        canvasElement.height = this.video.nativeElement.videoHeight;
        canvasElement.width = this.video.nativeElement.videoWidth;
        context.drawImage(this.video.nativeElement, 0, 0, canvasElement.width, canvasElement.height);
        const imageData = context.getImageData(0, 0, canvasElement.width, canvasElement.height);
        const code = jsQR(imageData.data, imageData.width, imageData.height, {
          inversionAttempts: 'dontInvert',
        });

        if (code) {
          this.ngZone.run(() => {
            this.processQrCode(code.data);
            this.stopScan();
          });
          return;
        }
      }
    }
    this.animationFrameId = requestAnimationFrame(() => this.tick());
  }

  private processQrCode(data: string) {
    this.scanError.set(null); // Clear any previous camera errors

    // Attempt 1: Parse as JSON
    try {
      const parsedData: any = JSON.parse(data);
      
      const productId = parsedData.productId || parsedData.pid;
      const name = parsedData.name;
      const expiryDate = parsedData.expiryDate || parsedData.expiry;

      if (productId && name && expiryDate) {
        const productData: ProductData = {
          productId,
          name,
          expiryDate,
        };
        this.scanResult.set(productData);
        this.checkProductStatus(productData.expiryDate);
        return; // Success
      }
    } catch (e) {
      // JSON parsing failed, proceed to next attempt
    }

    // Attempt 2: Check if the data is a valid date string
    const potentialDate = new Date(data);
    if (!isNaN(potentialDate.getTime()) && /\d/.test(data)) {
      const mockProductData: ProductData = {
        productId: 'N/A',
        name: 'Product (from date)',
        // Use ISO format YYYY-MM-DD for consistency
        expiryDate: potentialDate.toISOString().split('T')[0]
      };
      this.scanResult.set(mockProductData);
      this.checkProductStatus(mockProductData.expiryDate);
      return; // Success
    }

    // If all attempts fail, it's invalid
    this.scanResult.set(null);
    this.productStatus.set('invalid');
    console.error('Invalid QR code data format:', data);
  }
  
  private checkProductStatus(expiryDateStr: string) {
    const flightInfo = this.flightContextService.flightData();

    // Determine the "nearing expiry" threshold based on flight context
    let nearingExpiryThresholdDays = 7; // Default
    if (flightInfo.type === 'International') {
      // Use a longer threshold for long-haul flights on wide-body aircraft
      if (/(777|787|350|380)/.test(flightInfo.aircraft)) {
        nearingExpiryThresholdDays = 14;
      } else {
        nearingExpiryThresholdDays = 10;
      }
    } else { // Domestic flights have a shorter turnover
      nearingExpiryThresholdDays = 5;
    }
    
    const expiryDate = new Date(expiryDateStr);
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Normalize to start of day
    
    const thresholdDate = new Date();
    thresholdDate.setDate(today.getDate() + nearingExpiryThresholdDays);
    thresholdDate.setHours(0, 0, 0, 0);

    if (isNaN(expiryDate.getTime())) {
        this.productStatus.set('invalid');
        return;
    }

    if (expiryDate < today) {
      this.productStatus.set('expired');
    } else if (expiryDate <= thresholdDate) {
      this.productStatus.set('nearing_expiry');
    } else {
      this.productStatus.set('ok');
    }
  }

  ngOnDestroy() {
    this.stopScan();
  }
}
