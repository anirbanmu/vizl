<script lang="ts">
  import VisualizerStack from './components/VisualizerStack.svelte';
  import PlayerControls from './components/PlayerControls.svelte';
  import TrackInput from './components/TrackInput.svelte';
  import DebugPanel from './components/DebugPanel.svelte';
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

  let isPlaying = $state(false);
  let currentTestAudioType = $state<TestAudioType>('sine');
  let isDebugVisible = $state(false);

  function handlePlay(): void {
    if (audioContext.state === 'suspended') {
      audioContext.resume();
    }
    audioSource.setMode({ type: currentTestAudioType });
    isPlaying = true;
  }

  function handleStop(): void {
    audioSource.stop();
    isPlaying = false;
  }

  function handleTestTypeChange(type: TestAudioType): void {
    currentTestAudioType = type;
    if (isPlaying) {
      audioSource.setMode({ type });
    }
  }

  function handleTrackSubmit(url: string): void {
    console.log('Track URL submitted:', url);
    // TODO: Implement SoundCloud resolution in Phase 3
  }

  onMount(() => {
    const handleKeydown = (e: KeyboardEvent) => {
      // Toggle debug panel with Ctrl + ` (Backtick)
      if (e.ctrlKey && e.code === 'Backquote') {
        isDebugVisible = !isDebugVisible;
      }
    };
    window.addEventListener('keydown', handleKeydown);

    return () => {
      window.removeEventListener('keydown', handleKeydown);
      audioSource.stop();
    };
  });
</script>

<main class="app-container">
  <div class="visualizer-layer">
    <VisualizerStack analyser={audioAnalyser} />
  </div>

  <div class="ui-grid">
    <div class="header-area">
      <h1>VIZL <span class="version">v2.0</span></h1>
    </div>

    <div class="viewport-area"></div>

    <div class="controls-dock">
      <div class="controls-cell">
        <PlayerControls {isPlaying} onplay={handlePlay} onstop={handleStop} />
      </div>
      <div class="input-cell">
        <TrackInput onsubmit={handleTrackSubmit} />
      </div>
    </div>
  </div>

  <DebugPanel visible={isDebugVisible} activeType={currentTestAudioType} onchange={handleTestTypeChange} />
</main>

<style>
  :global(body) {
    overflow: hidden;
  }

  .app-container {
    position: relative;
    width: 100vw;
    height: 100vh;
    background: var(--color-bg);
    overflow: hidden;
  }

  .visualizer-layer {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    z-index: 1;
  }

  .ui-grid {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    z-index: 10;
    display: grid;
    grid-template-rows: 60px 1fr 80px;
    grid-template-columns: 1fr;
    pointer-events: none; /* Let clicks pass through to visualizer layer by default */
  }

  /* Header */
  .header-area {
    grid-row: 1;
    display: flex;
    align-items: center;
    padding: 0 var(--spacing-lg);
    border-bottom: var(--border-muted);
    background: rgba(0, 0, 0, 0.2);
    backdrop-filter: blur(2px);
    pointer-events: all;
  }

  h1 {
    font-size: 1.5rem;
    font-weight: 700;
    letter-spacing: 0.2rem;
    color: var(--color-fg);
    margin: 0;
  }

  .version {
    font-size: 0.75rem;
    color: var(--color-accent);
    vertical-align: super;
    margin-left: var(--spacing-xs);
  }

  .viewport-area {
    grid-row: 2;
  }

  .controls-dock {
    grid-row: 3;
    display: grid;
    grid-template-columns: auto 1fr;
    border-top: var(--border-default);
    background: var(--color-bg);
    pointer-events: all;
  }

  .controls-cell {
    border-right: var(--border-default);
    padding: 0 var(--spacing-lg);
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .input-cell {
    padding: 0 var(--spacing-lg);
    display: flex;
    align-items: center;
  }
</style>
