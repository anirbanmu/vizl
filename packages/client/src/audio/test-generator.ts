export type TestAudioType = 'sine' | 'sweep' | 'noise' | 'beat';

export interface TestAudioConfig {
  type: TestAudioType;
  frequency?: number;
  duration?: number;
}

export class TestAudioGenerator {
  private oscillator: OscillatorNode | null = null;
  private gainNode: GainNode;
  private noiseNode: AudioBufferSourceNode | null = null;
  private isPlaying = false;

  constructor(private audioContext: AudioContext) {
    this.gainNode = audioContext.createGain();
    this.gainNode.gain.value = 0.3;
    this.gainNode.connect(audioContext.destination);
  }

  start(config: TestAudioConfig): void {
    this.stop();
    this.isPlaying = true;

    switch (config.type) {
      case 'sine':
        this.startSine(config.frequency || 440);
        break;
      case 'sweep':
        this.startSweep();
        break;
      case 'noise':
        this.startNoise();
        break;
      case 'beat':
        this.startBeat(config.duration || 0.5);
        break;
    }
  }

  stop(): void {
    this.isPlaying = false;

    if (this.oscillator) {
      this.oscillator.stop();
      this.oscillator.disconnect();
      this.oscillator = null;
    }

    if (this.noiseNode) {
      this.noiseNode.stop();
      this.noiseNode.disconnect();
      this.noiseNode = null;
    }
  }

  getGainNode(): GainNode {
    return this.gainNode;
  }

  private startSine(frequency: number): void {
    this.oscillator = this.audioContext.createOscillator();
    this.oscillator.type = 'sine';
    this.oscillator.frequency.value = frequency;
    this.oscillator.connect(this.gainNode);
    this.oscillator.start();
  }

  private startSweep(): void {
    this.oscillator = this.audioContext.createOscillator();
    this.oscillator.type = 'sine';
    this.oscillator.frequency.value = 100;

    const now = this.audioContext.currentTime;
    const duration = 4;

    const sweep = (): void => {
      if (!this.isPlaying || !this.oscillator) return;
      this.oscillator.frequency.setValueAtTime(100, now);
      this.oscillator.frequency.exponentialRampToValueAtTime(2000, now + duration);
      setTimeout(() => sweep(), duration * 1000);
    };

    this.oscillator.connect(this.gainNode);
    this.oscillator.start();
    sweep();
  }

  private startNoise(): void {
    const bufferSize = this.audioContext.sampleRate * 2;
    const buffer = this.audioContext.createBuffer(1, bufferSize, this.audioContext.sampleRate);
    const data = buffer.getChannelData(0);

    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    this.noiseNode = this.audioContext.createBufferSource();
    this.noiseNode.buffer = buffer;
    this.noiseNode.loop = true;
    this.noiseNode.connect(this.gainNode);
    this.noiseNode.start();
  }

  private startBeat(duration: number): void {
    const playBeat = (): void => {
      if (!this.isPlaying) return;

      const osc = this.audioContext.createOscillator();
      const gain = this.audioContext.createGain();

      osc.type = 'sine';
      osc.frequency.value = 80;

      const now = this.audioContext.currentTime;
      gain.gain.setValueAtTime(0.5, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + duration);

      osc.connect(gain);
      gain.connect(this.gainNode);

      osc.start(now);
      osc.stop(now + duration);

      setTimeout(() => playBeat(), duration * 1000);
    };

    playBeat();
  }
}
