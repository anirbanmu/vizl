import type { AudioSource } from './types';

export class SoundCloudSource implements AudioSource {
  private audio: HTMLAudioElement;
  private sourceNode: MediaElementAudioSourceNode;
  private audioCtx: AudioContext;

  constructor(audioCtx: AudioContext) {
    this.audioCtx = audioCtx;
    this.audio = new Audio();
    this.audio.crossOrigin = 'anonymous';
    this.sourceNode = audioCtx.createMediaElementSource(this.audio);
  }

  connect(destination: AudioNode): void {
    this.sourceNode.connect(destination);
  }

  disconnect(): void {
    this.sourceNode.disconnect();
  }

  async load(streamUrl: string): Promise<void> {
    this.audio.src = streamUrl;
    await this.audio.load();
  }

  async play(): Promise<void> {
    if (this.audioCtx.state === 'suspended') {
      await this.audioCtx.resume();
    }
    return this.audio.play();
  }

  pause(): void {
    this.audio.pause();
  }

  stop(): void {
    this.audio.pause();
    this.audio.currentTime = 0;
  }

  getAudioElement(): HTMLAudioElement {
    return this.audio;
  }
}
