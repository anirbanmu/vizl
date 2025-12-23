<script lang="ts">
  import { FrequencyBackgroundVisualiser } from '../visualizers/freq-background';
  import { FrequencyRadialVisualiser } from '../visualizers/freq-radial';
  import { TimeRadialVisualiser } from '../visualizers/time-radial';
  import type { AudioAnalyser } from '../audio/analyser';
  import { onMount } from 'svelte';

  interface Props {
    analyser: AudioAnalyser;
    showDebugBorder?: boolean;
  }

  let { analyser, showDebugBorder = false }: Props = $props();

  let freqCanvas = $state<HTMLCanvasElement>();
  let freqRadialCanvas = $state<HTMLCanvasElement>();
  let timeCanvas = $state<HTMLCanvasElement>();

  let freqVisualizer!: FrequencyBackgroundVisualiser;
  let freqRadialVisualizer!: FrequencyRadialVisualiser;
  let timeVisualizer!: TimeRadialVisualiser;
  let webglError = $state<string | null>(null);
  let animationFrameId: number | null = null;

  const renderData = { frequencyData: new Float32Array(0), timeData: new Float32Array(0) };

  export function resize(): void {
    freqVisualizer.resize();
    freqRadialVisualizer.resize();
    timeVisualizer.resize();
  }

  function animate(): void {
    renderData.frequencyData = analyser.getFrequencyDataNormalized();
    renderData.timeData = analyser.getTimeData();

    freqVisualizer.render(renderData);
    freqRadialVisualizer.render(renderData);
    timeVisualizer.render(renderData);

    animationFrameId = requestAnimationFrame(animate);
  }

  onMount(() => {
    const metadata = analyser.metadata();

    try {
      freqVisualizer = new FrequencyBackgroundVisualiser(freqCanvas!, metadata);
      freqVisualizer.resize();
      freqRadialVisualizer = new FrequencyRadialVisualiser(freqRadialCanvas!, metadata);
      freqRadialVisualizer.resize();
      timeVisualizer = new TimeRadialVisualiser(timeCanvas!, metadata);
      timeVisualizer.resize();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'unknown error';
      webglError = `webgl initialization failed: ${message}`;
      console.error(webglError, error);
      return;
    }

    animate();
    window.addEventListener('resize', resize);

    return () => {
      window.removeEventListener('resize', resize);
      if (animationFrameId !== null) {
        cancelAnimationFrame(animationFrameId);
      }
    };
  });
</script>

<div class="visualizer-stack" class:debug={showDebugBorder}>
  {#if webglError}
    <p class="error">{webglError}</p>
  {:else}
    <canvas bind:this={freqCanvas} class="layer" style="z-index: 1; opacity: 0.5;"></canvas>
    <canvas bind:this={timeCanvas} class="layer" style="z-index: 2;"></canvas>
    <canvas bind:this={freqRadialCanvas} class="layer" style="z-index: 3;"></canvas>
  {/if}
</div>

<style>
  .visualizer-stack {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
  }

  .visualizer-stack.debug {
    border: var(--border-accent);
  }

  .layer {
    position: absolute;
    top: 0;
    left: 0;
    display: block;
    width: 100%;
    height: 100%;
  }

  .error {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    color: var(--color-accent);
    padding: var(--spacing-lg);
    font-family: var(--font-mono);
    border: var(--border-accent);
  }
</style>
