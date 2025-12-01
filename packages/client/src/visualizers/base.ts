import type { AudioAnalysisData, AudioAnalysisMetadata } from '../audio/types';

export interface Vector2d {
  x: number;
  y: number;
}

export function hexToRGB(h: number): Array<number> {
  const mask = 0xff;
  return [(h >> 16) & mask, (h >> 8) & mask, h & mask].map(x => x / 255);
}

export abstract class BaseAudioVisualiser {
  private resizeObserver: ResizeObserver;

  constructor(
    protected canvas: HTMLCanvasElement,
    private metadata: AudioAnalysisMetadata,
  ) {
    this.resizeObserver = new ResizeObserver(entries => {
      for (const entry of entries) {
        if (entry.target === this.canvas) {
          const { width, height } = entry.contentRect;
          this.resize(width, height);
        }
      }
    });
    this.resizeObserver.observe(this.canvas);
  }

  abstract render(data: AudioAnalysisData): void;

  resize(width: number = 0, height: number = 0): void {
    const pixelRatio = window.devicePixelRatio || 1;
    const displayWidth = width || this.canvas.clientWidth;
    const displayHeight = height || this.canvas.clientHeight;

    const needWidth = Math.floor(displayWidth * pixelRatio);
    const needHeight = Math.floor(displayHeight * pixelRatio);

    if (this.canvas.width !== needWidth || this.canvas.height !== needHeight) {
      this.canvas.width = needWidth;
      this.canvas.height = needHeight;
    }
  }

  destroy(): void {
    this.resizeObserver.disconnect();
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
