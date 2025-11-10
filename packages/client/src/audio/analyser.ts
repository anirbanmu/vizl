import type { AudioAnalysisMetadata } from './types';

export class AudioAnalyser {
  public readonly minDb: number;
  public readonly maxDb: number;
  public readonly freqBinCount: number;
  public readonly timeFftSize: number;

  private frequencyAnalyser: AnalyserNode;
  private frequencyData: Float32Array<ArrayBuffer>;

  private timeAnalyser: AnalyserNode;
  private timeData: Float32Array<ArrayBuffer>;
  private timeDataWeighted: Float32Array<ArrayBuffer>;

  constructor(
    audioCtx: AudioContext,
    mediaSourceNode: MediaElementAudioSourceNode,
    frequencyFftSize: number,
    timeFftSize: number,
  ) {
    this.frequencyAnalyser = audioCtx.createAnalyser();
    this.frequencyAnalyser.fftSize = frequencyFftSize;
    this.frequencyAnalyser.smoothingTimeConstant = 0.89;
    mediaSourceNode.connect(this.frequencyAnalyser);
    this.frequencyData = new Float32Array(this.frequencyAnalyser.frequencyBinCount);

    this.timeAnalyser = audioCtx.createAnalyser();
    this.timeAnalyser.fftSize = timeFftSize;
    this.timeAnalyser.smoothingTimeConstant = 1;
    mediaSourceNode.connect(this.timeAnalyser);
    this.timeData = new Float32Array(this.timeAnalyser.fftSize);
    this.timeDataWeighted = new Float32Array(this.timeAnalyser.fftSize);

    this.timeFftSize = this.timeAnalyser.fftSize;
    this.freqBinCount = this.frequencyAnalyser.frequencyBinCount;
    this.minDb = this.frequencyAnalyser.minDecibels;
    this.maxDb = this.frequencyAnalyser.maxDecibels;
  }

  public getFrequencyData(): Float32Array<ArrayBuffer> {
    this.frequencyAnalyser.getFloatFrequencyData(this.frequencyData);
    return this.frequencyData;
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
