// audio analysis configuration
export const AUDIO_CONFIG = {
  // frequency analyzer - for spectrum visualization
  frequency: {
    fftSize: 256,
    smoothingTimeConstant: 0.89,
  },
  // time domain analyzer - for waveform visualization
  time: {
    fftSize: 4096,
    smoothingTimeConstant: 0,
  },
} as const;

export type AudioConfig = typeof AUDIO_CONFIG;

// raw audio data arrays produced by web audio api analyzers each frame
export interface AudioAnalysisData {
  frequencyData: Float32Array;
  timeData: Float32Array;
}

// static metadata about audio analysis configuration set during initialization
export interface AudioAnalysisMetadata {
  minDb: number;
  maxDb: number;
  frequencyBinCount: number;
  timeFftSize: number;
}
