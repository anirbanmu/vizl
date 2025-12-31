export interface AudioConfig {
  frequency: {
    fftSize: number;
    smoothingTimeConstant: number;
  };
  time: {
    fftSize: number;
    smoothingTimeConstant: number;
  };
}

export interface AudioAnalysisData {
  frequencyData: Float32Array;
  timeData: Float32Array;
}

export interface AudioAnalysisMetadata {
  minDb: number;
  maxDb: number;
  frequencyBinCount: number;
  timeFftSize: number;
}

export interface AudioSource {
  connect(destination: AudioNode): void;
  disconnect(): void;
  play(): Promise<void> | void;
  pause(): void;
  stop(): void;
  seek(time: number): void;
  get currentTime(): number;
  get duration(): number;
  setOnTimeUpdate(callback: (time: number) => void): void;
}
