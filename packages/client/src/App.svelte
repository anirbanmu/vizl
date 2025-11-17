<script lang="ts">
  import { AUDIO_CONFIG } from './audio/types';
  import { TestTriangleVisualiser } from './visualizers/test-triangle';
  import type { AudioAnalysisMetadata } from './audio/types';
  import { TestAudioGenerator, type TestAudioType } from './audio/test-generator';
  import { onMount } from 'svelte';

  let canvas = $state<HTMLCanvasElement>();
  let visualizer: TestTriangleVisualiser | null = null;
  let webglError = $state<string | null>(null);
  let audioContext: AudioContext | null = null;
  let testAudioGenerator: TestAudioGenerator | null = null;
  let frequencyAnalyser: AnalyserNode | null = null;
  let timeAnalyser: AnalyserNode | null = null;
  let isTestAudioPlaying = $state(false);
  let currentTestAudioType = $state<TestAudioType>('sine');

  function setupAudioContext(): void {
    audioContext = new AudioContext();
    testAudioGenerator = new TestAudioGenerator(audioContext);

    frequencyAnalyser = audioContext.createAnalyser();
    frequencyAnalyser.fftSize = AUDIO_CONFIG.frequency.fftSize;
    frequencyAnalyser.smoothingTimeConstant = AUDIO_CONFIG.frequency.smoothingTimeConstant;

    timeAnalyser = audioContext.createAnalyser();
    timeAnalyser.fftSize = AUDIO_CONFIG.time.fftSize;
    timeAnalyser.smoothingTimeConstant = AUDIO_CONFIG.time.smoothingTimeConstant;

    const gainNode = testAudioGenerator.getGainNode();
    gainNode.connect(frequencyAnalyser);
    gainNode.connect(timeAnalyser);
  }

  function toggleTestAudio(): void {
    if (!audioContext) {
      setupAudioContext();
    }

    if (audioContext!.state === 'suspended') {
      audioContext!.resume();
    }

    if (isTestAudioPlaying) {
      testAudioGenerator?.stop();
      isTestAudioPlaying = false;
    } else {
      testAudioGenerator?.start({ type: currentTestAudioType });
      isTestAudioPlaying = true;
    }
  }

  function changeTestAudioType(type: TestAudioType): void {
    currentTestAudioType = type;
    if (isTestAudioPlaying && testAudioGenerator) {
      testAudioGenerator.start({ type });
    }
  }

  onMount(() => {
    if (!canvas) return;

    setupAudioContext();

    const metadata: AudioAnalysisMetadata = {
      minDb: frequencyAnalyser!.minDecibels,
      maxDb: frequencyAnalyser!.maxDecibels,
      frequencyBinCount: frequencyAnalyser!.frequencyBinCount,
      timeFftSize: timeAnalyser!.fftSize,
    };

    try {
      visualizer = new TestTriangleVisualiser(canvas, metadata);
      visualizer.resize(600, 600);
      visualizer.initialize();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'unknown error';
      webglError = `webgl initialization failed: ${message}`;
      console.error(webglError, error);
      return;
    }

    const frequencyData = new Float32Array(metadata.frequencyBinCount);
    const timeData = new Float32Array(metadata.timeFftSize);

    function animate(): void {
      if (!visualizer || !frequencyAnalyser || !timeAnalyser) return;

      frequencyAnalyser.getFloatFrequencyData(frequencyData);

      for (let i = 0; i < frequencyData.length; i++) {
        frequencyData[i] = (frequencyData[i] - metadata.minDb) / (metadata.maxDb - metadata.minDb);
        frequencyData[i] = Math.max(0, Math.min(1, frequencyData[i]));
      }

      timeAnalyser.getFloatTimeDomainData(timeData);

      visualizer.render({ frequencyData, timeData });
      requestAnimationFrame(animate);
    }

    animate();

    const handleResize = (): void => {
      if (visualizer) {
        visualizer.resize();
      }
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      if (testAudioGenerator) {
        testAudioGenerator.stop();
      }
      visualizer = null;
    };
  });
</script>

<main>
  <h1>vizl</h1>

  <div class="visualizer">
    {#if webglError}
      <p class="error">{webglError}</p>
    {:else}
      <canvas bind:this={canvas}></canvas>
    {/if}
  </div>

  <div class="controls">
    <button onclick={toggleTestAudio} class:active={isTestAudioPlaying}>
      {isTestAudioPlaying ? '⏸️ stop' : '▶️ play'}
    </button>

    <div class="audio-types">
      <button
        onclick={() => changeTestAudioType('sine')}
        class:selected={currentTestAudioType === 'sine'}
      >
        sine
      </button>
      <button
        onclick={() => changeTestAudioType('sweep')}
        class:selected={currentTestAudioType === 'sweep'}
      >
        sweep
      </button>
      <button
        onclick={() => changeTestAudioType('noise')}
        class:selected={currentTestAudioType === 'noise'}
      >
        noise
      </button>
      <button
        onclick={() => changeTestAudioType('beat')}
        class:selected={currentTestAudioType === 'beat'}
      >
        beat
      </button>
    </div>
  </div>
</main>

<style>
  main {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    min-height: 100vh;
    padding: 2rem;
    background: #000;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  }

  h1 {
    color: #00d1b2;
    margin-bottom: 2rem;
    font-size: 3rem;
    font-weight: 300;
    letter-spacing: 0.5rem;
  }

  .visualizer {
    margin-bottom: 2rem;
  }

  .visualizer canvas {
    display: block;
    width: 600px;
    height: 600px;
  }

  .visualizer .error {
    color: #ff6b6b;
    padding: 2rem;
    font-family: monospace;
  }

  .controls {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    align-items: center;
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