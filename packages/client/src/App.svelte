<script lang="ts">
  import { FrequencyBackgroundVisualiser } from './visualizers/freq-background';
  import { FrequencyRadialVisualiser } from './visualizers/freq-radial';
  import { TimeRadialVisualiser } from './visualizers/time-radial';
  import type { AudioSource, AudioConfig } from './audio/types';
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

  let freqCanvas = $state<HTMLCanvasElement>();
  let freqRadialCanvas = $state<HTMLCanvasElement>();
  let timeCanvas = $state<HTMLCanvasElement>();
  let freqVisualizer: FrequencyBackgroundVisualiser | null = null;
  let freqRadialVisualizer: FrequencyRadialVisualiser | null = null;
  let timeVisualizer: TimeRadialVisualiser | null = null;
  let webglError = $state<string | null>(null);
  let audioContext: AudioContext | null = null;
  let audioSource: AudioSource | null = null;
  let audioAnalyser: AudioAnalyser | null = null;
  let isTestAudioPlaying = $state(false);
  let currentTestAudioType = $state<TestAudioType>('sine');

  function setupAudioContext(): void {
    audioContext = new AudioContext();

    audioAnalyser = new AudioAnalyser(audioContext, AUDIO_CONFIG);

    // default to TestToneSource for now
    audioSource = new TestToneSource(audioContext);
    audioSource.connect(audioAnalyser.node);
  }

  function toggleTestAudio(): void {
    if (!audioContext) {
      setupAudioContext();
    }

    if (audioContext!.state === 'suspended') {
      audioContext!.resume();
    }

    if (isTestAudioPlaying) {
      audioSource?.stop();
      isTestAudioPlaying = false;
    } else {
      if (audioSource instanceof TestToneSource) {
        audioSource.setMode({ type: currentTestAudioType });
      }
      audioSource?.play();
      isTestAudioPlaying = true;
    }
  }

  function changeTestAudioType(type: TestAudioType): void {
    currentTestAudioType = type;
    if (isTestAudioPlaying && audioSource instanceof TestToneSource) {
      audioSource.setMode({ type });
    }
  }

  onMount(() => {
    if (!freqCanvas || !freqRadialCanvas || !timeCanvas) return;

    setupAudioContext();

    const metadata = audioAnalyser!.metadata();

    try {
      freqVisualizer = new FrequencyBackgroundVisualiser(freqCanvas, metadata);
      freqVisualizer.resize();
      freqRadialVisualizer = new FrequencyRadialVisualiser(freqRadialCanvas, metadata);
      freqRadialVisualizer.resize();
      timeVisualizer = new TimeRadialVisualiser(timeCanvas, metadata);
      timeVisualizer.resize();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'unknown error';
      webglError = `webgl initialization failed: ${message}`;
      console.error(webglError, error);
      return;
    }

    function animate(): void {
      if (!freqVisualizer || !freqRadialVisualizer || !timeVisualizer || !audioAnalyser) return;

      const frequencyData = audioAnalyser.getFrequencyDataNormalized();
      const timeData = audioAnalyser.getTimeData();

      freqVisualizer.render({ frequencyData: frequencyData, timeData });
      freqRadialVisualizer.render({ frequencyData: frequencyData, timeData });
      timeVisualizer.render({ frequencyData: frequencyData, timeData });
      requestAnimationFrame(animate);
    }

    animate();

    const handleResize = (): void => {
      if (freqVisualizer) {
        freqVisualizer.resize();
      }
      if (freqRadialVisualizer) {
        freqRadialVisualizer.resize();
      }
      if (timeVisualizer) {
        timeVisualizer.resize();
      }
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      if (audioSource) {
        audioSource.stop();
      }
      freqVisualizer = null;
      freqRadialVisualizer = null;
      timeVisualizer = null;
    };
  });
</script>

<main>
  <h1>vizl</h1>

  <div class="visualizer">
    {#if webglError}
      <p class="error">{webglError}</p>
    {:else}
      <canvas bind:this={freqCanvas} class="layer" style="z-index: 1; opacity: 0.5;"></canvas>
      <canvas bind:this={timeCanvas} class="layer" style="z-index: 2;"></canvas>
      <canvas bind:this={freqRadialCanvas} class="layer" style="z-index: 3;"></canvas>
    {/if}
  </div>

  <div class="controls">
    <button onclick={toggleTestAudio} class:active={isTestAudioPlaying}>
      {isTestAudioPlaying ? '⏸️ stop' : '▶️ play'}
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
    background: #000;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  }

  h1 {
    position: absolute;
    top: 2rem;
    left: 50%;
    transform: translateX(-50%);
    color: #00d1b2;
    margin: 0;
    font-size: 3rem;
    font-weight: 300;
    letter-spacing: 0.5rem;
    z-index: 100;
  }

  .visualizer {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
  }

  .visualizer .layer {
    position: absolute;
    top: 0;
    left: 0;
    display: block;
    width: 100%;
    height: 100%;
  }

  .visualizer .error {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    color: #ff6b6b;
    padding: 2rem;
    font-family: monospace;
  }

  .controls {
    position: absolute;
    bottom: 2rem;
    left: 50%;
    transform: translateX(-50%);
    display: flex;
    flex-direction: column;
    gap: 1rem;
    align-items: center;
    z-index: 100;
  }

  button {
    background: #007acc;
    color: white;
    border: none;
    padding: 0.75rem 1.5rem;
    border-radius: 4px;
    cursor: pointer;
    font-size: 1rem;
    transition: background 0.2s;
  }

  button:hover {
    background: #005a9e;
  }

  .controls > button {
    font-size: 1.1rem;
    min-width: 120px;
  }

  .controls > button.active {
    background: #ff6b6b;
  }

  .controls > button.active:hover {
    background: #ff5252;
  }

  .audio-types {
    display: flex;
    gap: 0.5rem;
  }

  .audio-types button {
    background: rgba(255, 255, 255, 0.1);
    color: #999;
    font-size: 0.9rem;
    padding: 0.5rem 1rem;
  }

  .audio-types button:hover {
    background: rgba(255, 255, 255, 0.15);
    color: #ccc;
  }

  .audio-types button.selected {
    background: #007acc;
    color: white;
  }

  .audio-types button.selected:hover {
    background: #005a9e;
  }
</style>
