<script lang="ts">
  import VisualizerStack from './components/VisualizerStack.svelte';
  import type { AudioConfig } from './audio/types';
  import { TestToneSource } from './audio/test-tone-source';
  import { AudioAnalyser } from './audio/analyser';
  import type { TestAudioType } from './audio/test-generator';
  import { onMount } from 'svelte';

  const AUDIO_CONFIG: AudioConfig = {
    frequency: {
      fftSize: 256,
      smoothingTimeConstant: 0.89,
    },
    time: {
      fftSize: 4096,
      smoothingTimeConstant: 0,
    },
  };

  const audioContext = new AudioContext();
  const audioAnalyser = new AudioAnalyser(audioContext, AUDIO_CONFIG);
  const audioSource = new TestToneSource(audioContext);
  audioSource.connect(audioAnalyser.node);

  let isTestAudioPlaying = $state(false);
  let currentTestAudioType = $state<TestAudioType>('sine');

  function toggleTestAudio(): void {
    if (audioContext.state === 'suspended') {
      audioContext.resume();
    }

    if (isTestAudioPlaying) {
      audioSource.stop();
      isTestAudioPlaying = false;
    } else {
      audioSource.setMode({ type: currentTestAudioType });
      audioSource.play();
      isTestAudioPlaying = true;
    }
  }

  function changeTestAudioType(type: TestAudioType): void {
    currentTestAudioType = type;
    if (isTestAudioPlaying) {
      audioSource.setMode({ type });
    }
  }

  onMount(() => {
    return () => {
      audioSource.stop();
    };
  });
</script>

<main>
  <h1>vizl</h1>

  <VisualizerStack analyser={audioAnalyser} />

  <div class="controls">
    <button onclick={toggleTestAudio} class:active={isTestAudioPlaying}>
      {isTestAudioPlaying ? '■ STOP' : '▶ PLAY'}
    </button>

    <div class="audio-types">
      <button onclick={() => changeTestAudioType('sine')} class:selected={currentTestAudioType === 'sine'}>
        sine
      </button>
      <button onclick={() => changeTestAudioType('sweep')} class:selected={currentTestAudioType === 'sweep'}>
        sweep
      </button>
      <button onclick={() => changeTestAudioType('noise')} class:selected={currentTestAudioType === 'noise'}>
        noise
      </button>
      <button onclick={() => changeTestAudioType('beat')} class:selected={currentTestAudioType === 'beat'}>
        beat
      </button>
    </div>
  </div>
</main>

<style>
  main {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    margin: 0;
    padding: 0;
    background: var(--color-bg);
    font-family: var(--font-mono);
  }

  h1 {
    position: absolute;
    top: var(--spacing-lg);
    left: 50%;
    transform: translateX(-50%);
    color: var(--color-accent);
    margin: 0;
    font-size: 2rem;
    font-weight: 500;
    letter-spacing: 0.3rem;
    text-transform: uppercase;
    z-index: 100;
  }

  .controls {
    position: absolute;
    bottom: var(--spacing-lg);
    left: 50%;
    transform: translateX(-50%);
    display: flex;
    flex-direction: column;
    gap: var(--spacing-md);
    align-items: center;
    z-index: 100;
  }

  button {
    background: var(--color-bg);
    color: var(--color-fg);
    border: var(--border-default);
    padding: var(--spacing-sm) var(--spacing-md);
    cursor: pointer;
    font-family: var(--font-mono);
    font-size: 0.875rem;
    text-transform: uppercase;
    letter-spacing: 0.05rem;
    transition: none;
  }

  button:hover {
    background: var(--color-fg);
    color: var(--color-bg);
  }

  .controls > button {
    min-width: 120px;
  }

  .controls > button.active {
    background: var(--color-accent);
    color: var(--color-bg);
    border-color: var(--color-accent);
  }

  .controls > button.active:hover {
    background: var(--color-fg);
    color: var(--color-bg);
    border-color: var(--color-fg);
  }

  .audio-types {
    display: flex;
    gap: var(--spacing-sm);
  }

  .audio-types button {
    color: var(--color-muted);
    border-color: var(--color-muted);
    padding: var(--spacing-xs) var(--spacing-sm);
  }

  .audio-types button:hover {
    color: var(--color-bg);
    background: var(--color-fg);
    border-color: var(--color-fg);
  }

  .audio-types button.selected {
    background: var(--color-fg);
    color: var(--color-bg);
    border-color: var(--color-fg);
  }

  .audio-types button.selected:hover {
    background: var(--color-accent);
    border-color: var(--color-accent);
  }
</style>
