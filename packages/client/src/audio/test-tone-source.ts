import type { AudioSource } from './types';
import { TestAudioGenerator, type TestAudioConfig } from './test-generator';

export class TestToneSource implements AudioSource {
  private generator: TestAudioGenerator;

  constructor(audioCtx: AudioContext) {
    this.generator = new TestAudioGenerator(audioCtx);
  }

  get currentTime(): number {
    return 0;
  }

  get duration(): number {
    return 0;
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  seek(_time: number): void {
    // no-op for test tones
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  setOnTimeUpdate(_callback: (time: number) => void): void {
    // no-op
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  setOnEnded(_callback: () => void): void {
    // no-op
  }

  connect(destination: AudioNode): void {
    this.generator.getGainNode().connect(destination);
  }

  disconnect(): void {
    this.generator.getGainNode().disconnect();
  }

  play(): void {
    // default to a sine wave if play is called without specific config
    // or resume previous state if possible (though generator is stateless mostly)
    this.generator.start({ type: 'sine', frequency: 150 });
  }

  pause(): void {
    this.stop();
  }

  stop(): void {
    this.generator.stop();
  }

  setMode(config: TestAudioConfig): void {
    this.generator.start(config);
  }
}
