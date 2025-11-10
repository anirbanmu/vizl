export const AUDIO_CONFIG = {
  frequency: {
    fftSize: 256,
    smoothingTimeConstant: 0.89,
  },
  time: {
    fftSize: 4096,
    smoothingTimeConstant: 0,
  },
} as const;

export type AudioConfig = typeof AUDIO_CONFIG;

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
