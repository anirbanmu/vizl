import type { AudioAnalysisMetadata, AudioConfig } from './types';

export class AudioAnalyser {
  public readonly minDb: number;
  public readonly maxDb: number;
  public readonly freqBinCount: number;
  public readonly timeFftSize: number;

  private readonly input: GainNode;

  public get node(): AudioNode {
    return this.input;
  }

  private frequencyAnalyser: AnalyserNode;
  private frequencyData: Float32Array<ArrayBuffer>;
  private frequencyDataNormalized: Float32Array<ArrayBuffer>;

  private timeAnalyser: AnalyserNode;
  private timeData: Float32Array<ArrayBuffer>;
  private timeDataWeighted: Float32Array<ArrayBuffer>;

  private dbRange: number;

  constructor(audioCtx: AudioContext, config: AudioConfig) {
    this.input = audioCtx.createGain();

    // frequency analyser setup
    this.frequencyAnalyser = audioCtx.createAnalyser();
    this.frequencyAnalyser.fftSize = config.frequency.fftSize;
    this.frequencyAnalyser.smoothingTimeConstant = config.frequency.smoothingTimeConstant;
    this.input.connect(this.frequencyAnalyser);
    this.frequencyData = new Float32Array(this.frequencyAnalyser.frequencyBinCount);
    this.frequencyDataNormalized = new Float32Array(this.frequencyAnalyser.frequencyBinCount);

    // time analyser setup
    this.timeAnalyser = audioCtx.createAnalyser();
    this.timeAnalyser.fftSize = config.time.fftSize;
    this.timeAnalyser.smoothingTimeConstant = config.time.smoothingTimeConstant;
    this.input.connect(this.timeAnalyser);
    this.timeData = new Float32Array(this.timeAnalyser.fftSize);
    this.timeDataWeighted = new Float32Array(this.timeAnalyser.fftSize);

    this.timeFftSize = this.timeAnalyser.fftSize;
    this.freqBinCount = this.frequencyAnalyser.frequencyBinCount;
    this.minDb = this.frequencyAnalyser.minDecibels;
    this.maxDb = this.frequencyAnalyser.maxDecibels;
    this.dbRange = this.maxDb - this.minDb;
  }

  public getFrequencyData(): Float32Array<ArrayBuffer> {
    this.frequencyAnalyser.getFloatFrequencyData(this.frequencyData);
    return this.frequencyData;
  }

  public getFrequencyDataNormalized(): Float32Array<ArrayBuffer> {
    this.frequencyAnalyser.getFloatFrequencyData(this.frequencyData);
    for (let i = 0; i < this.frequencyData.length; i++) {
      const val = (this.frequencyData[i] - this.minDb) / this.dbRange;
      // clamp between 0 and 1
      this.frequencyDataNormalized[i] = Math.max(0, Math.min(1, val));
    }
    return this.frequencyDataNormalized;
  }

  public getTimeData(): Float32Array<ArrayBuffer> {
    this.timeAnalyser.getFloatTimeDomainData(this.timeData);
    return this.timeData;
  }

  public getTimeDataExtraWeighted(weight: number): Float32Array<ArrayBuffer> {
    this.timeAnalyser.getFloatTimeDomainData(this.timeData);
    for (let i = 0; i < this.timeData.length; ++i) {
      this.timeDataWeighted[i] = this.timeDataWeighted[i] * weight + this.timeData[i] * (1 - weight);
    }
    return this.timeDataWeighted;
  }

  public metadata(): AudioAnalysisMetadata {
    return {
      minDb: this.minDb,
      maxDb: this.maxDb,
      frequencyBinCount: this.freqBinCount,
      timeFftSize: this.timeFftSize,
    };
  }
}
