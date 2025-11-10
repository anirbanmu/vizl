import type { AudioAnalysisData, AudioAnalysisMetadata } from '../audio/types';

export interface Vector2d {
  x: number;
  y: number;
}

export abstract class BaseAudioVisualiser {
  constructor(
    protected canvas: HTMLCanvasElement,
    private metadata: AudioAnalysisMetadata,
  ) {}

  abstract render(data: AudioAnalysisData): void;

  resize(width: number = 0, height: number = 0): void {
    this.canvas.width = width || this.canvas.clientWidth;
    this.canvas.height = height || this.canvas.clientHeight;
  }

  protected minDim(): number {
    return Math.min(this.canvas.width, this.canvas.height);
  }

  protected center(): Vector2d {
    return { x: this.canvas.width / 2, y: this.canvas.height / 2 };
  }

  protected get minDb(): number {
    return this.metadata.minDb;
  }

  protected get maxDb(): number {
    return this.metadata.maxDb;
  }

  protected get frequencyBinCount(): number {
    return this.metadata.frequencyBinCount;
  }

  protected get timeFftSize(): number {
    return this.metadata.timeFftSize;
  }
}
