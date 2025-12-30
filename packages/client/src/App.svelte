<script lang="ts">
  import VisualizerStack from './components/VisualizerStack.svelte';
  import PlayerControls from './components/PlayerControls.svelte';
  import TrackInput from './components/TrackInput.svelte';
  import DebugPanel from './components/DebugPanel.svelte';
  import type { AudioConfig, AudioSource } from './audio/types';
  import { TestToneSource } from './audio/test-tone-source';
  import { SoundCloudSource } from './audio/soundcloud-source';
  import { AudioAnalyser } from './audio/analyser';
  import type { TestAudioType } from './audio/test-generator';
  import type { Track } from '@common/track';
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

  // Connect analyser to output so we can hear it
  audioAnalyser.node.connect(audioContext.destination);

  const testToneSource = new TestToneSource(audioContext);
  const soundCloudSource = new SoundCloudSource(audioContext);

  // Default to test tone initially, but switch based on user action
  let currentSource = $state<AudioSource>(testToneSource);

  testToneSource.connect(audioAnalyser.node);
  soundCloudSource.connect(audioAnalyser.node);

  let isPlaying = $state(false);
  let currentTestAudioType = $state<TestAudioType>('sine');
  let isDebugVisible = $state(false);

  let currentTrack = $state<Track | null>(null);
  let isLoading = $state(false);
  let error = $state<string | null>(null);

  function switchSource(source: AudioSource) {
    if (currentSource === source) return;

    currentSource.stop();
    currentSource = source;
  }

  async function handlePlay(): Promise<void> {
    if (audioContext.state === 'suspended') {
      await audioContext.resume();
    }

    if (currentSource instanceof TestToneSource) {
      currentSource.setMode({ type: currentTestAudioType });
    }

    try {
      await currentSource.play();
      isPlaying = true;
    } catch (err) {
      console.error('Playback failed:', err);
      error = 'Playback failed';
    }
  }

  function handleStop(): void {
    currentSource.stop();
    isPlaying = false;
  }

  function handleTestTypeChange(type: TestAudioType): void {
    currentTestAudioType = type;

    // Implicitly switch to test source when changing test type
    switchSource(testToneSource);

    if (isPlaying) {
      testToneSource.setMode({ type });
    }
  }

  async function resolveTrack(url: string): Promise<void> {
    isLoading = true;
    error = null;

    try {
      const res = await fetch('/api/resolve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || 'Failed to resolve track');
      }

      const track: Track = await res.json();
      currentTrack = track;

      // Load audio, switch source, and play
      await soundCloudSource.load(track.streamUrl);
      switchSource(soundCloudSource);
      await handlePlay();
    } catch (err) {
      console.error('Track resolution failed:', err);
      error = err instanceof Error ? err.message : 'Failed to load track';
    } finally {
      isLoading = false;
    }
  }

  function handleTrackSubmit(url: string): void {
    resolveTrack(url);
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
      testToneSource.stop();
      soundCloudSource.stop();
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
      {#if currentTrack}
        <div class="track-info">
          <span class="track-artist">{currentTrack.user.name}</span>
          <span class="track-separator">//</span>
          <span class="track-title">{currentTrack.title}</span>
        </div>
      {/if}
      {#if error}
        <div class="error-message">[{error}]</div>
      {/if}
    </div>

    <div class="viewport-area"></div>

    <div class="controls-dock">
      <div class="controls-cell">
        <PlayerControls {isPlaying} onplay={handlePlay} onstop={handleStop} />
      </div>
      <div class="input-cell">
        <TrackInput
          onsubmit={handleTrackSubmit}
          disabled={isLoading}
          placeholder={isLoading ? 'resolving stream...' : undefined}
        />
      </div>
      <div class="attribution-cell">
        <img src="/powered_by_soundcloud.png" alt="Powered by SoundCloud" class="sc-logo" />
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

  .track-info {
    margin-left: var(--spacing-xl);
    display: flex;
    align-items: center;
    gap: var(--spacing-sm);
    font-family: var(--font-mono);
    font-size: 0.875rem;
    color: var(--color-fg);
    opacity: 0.8;
  }

  .track-artist {
    color: var(--color-muted);
  }

  .track-separator {
    color: var(--color-accent);
  }

  .error-message {
    margin-left: auto;
    color: var(--color-accent);
    font-family: var(--font-mono);
    font-size: 0.875rem;
  }

  .viewport-area {
    grid-row: 2;
  }

  .controls-dock {
    grid-row: 3;
    display: grid;
    grid-template-columns: auto 1fr auto;
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

  .attribution-cell {
    padding: 0 var(--spacing-lg);
    display: flex;
    align-items: center;
    justify-content: center;
    border-left: var(--border-default);
  }

  .sc-logo {
    height: 32px; /* Adjust as needed */
    opacity: 0.7;
  }
</style>
