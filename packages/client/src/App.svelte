<script lang="ts">
  import VisualizerStack from './components/VisualizerStack.svelte';
  import PlayerControls from './components/PlayerControls.svelte';
  import TrackInput from './components/TrackInput.svelte';
  import DebugPanel from './components/DebugPanel.svelte';
  import SeekBar from './components/SeekBar.svelte';
  import type { AudioConfig, AudioSource } from './audio/types';
  import { TestToneSource } from './audio/test-tone-source';
  import { SoundCloudSource } from './audio/soundcloud-source';
  import { AudioAnalyser } from './audio/analyser';
  import type { TestAudioType } from './audio/test-generator';
  import type { Track } from '@common/track';
  import { onMount } from 'svelte';

  const AUDIO_CONFIG: AudioConfig = {
    frequency: {
      fftSize: 64,
      smoothingTimeConstant: 0.89,
    },
    time: {
      fftSize: 4096,
      smoothingTimeConstant: 0,
    },
  };

  const audioContext = new AudioContext();
  const audioAnalyser = new AudioAnalyser(audioContext, AUDIO_CONFIG);

  // connect analyser to output so we can hear it
  audioAnalyser.node.connect(audioContext.destination);

  const testToneSource = new TestToneSource(audioContext);
  const soundCloudSource = new SoundCloudSource(audioContext);

  // default to test tone initially, but switch based on user action
  let currentSource = $state<AudioSource>(testToneSource);

  testToneSource.connect(audioAnalyser.node);
  soundCloudSource.connect(audioAnalyser.node);

  let isPlaying = $state(false);
  let currentTestAudioType = $state<TestAudioType>('sine');
  let isDebugVisible = $state(false);

  let currentTrack = $state<Track | null>(null);
  let isLoading = $state(false);
  let error = $state<string | null>(null);
  let trackUrl = $state('');

  let currentTime = $state(0);
  let duration = $state(0);

  function switchSource(source: AudioSource) {
    if (currentSource === source) return;

    currentSource.stop();
    // clear old time update and ended listeners
    currentSource.setOnTimeUpdate(() => {});
    currentSource.setOnEnded(() => {});

    currentSource = source;

    // reset state
    currentTime = source.currentTime;
    duration = source.duration;

    // attach new listener
    currentSource.setOnTimeUpdate(t => {
      currentTime = t;
      duration = source.duration; // update duration in case it changes
    });

    currentSource.setOnEnded(() => {
      isPlaying = false;
      currentTime = 0;
      currentSource.seek(0);
    });
  }

  function handleSeek(time: number) {
    if (currentSource) {
      currentSource.seek(time);
      currentTime = time;
    }
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
    currentSource.pause();
    isPlaying = false;
  }

  function handleTestTypeChange(type: TestAudioType): void {
    currentTestAudioType = type;

    // implicitly switch to test source when changing test type
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

      // load audio, switch source, and play
      await soundCloudSource.load(track.streamUrl);
      switchSource(soundCloudSource);
      await handlePlay();
      trackUrl = '';
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
      // toggle debug panel with ctrl + ` (backtick)
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
      <h1>
        <div class="header-logo" role="img" aria-label="VIZL"></div>
        <span class="version">v2.0</span>
      </h1>
      {#if currentTrack}
        <div class="track-info">
          <a href={currentTrack.user.profile} target="_blank" rel="noopener noreferrer" class="info-link track-artist">
            {currentTrack.user.name}
          </a>
          <span class="track-separator">//</span>
          <a href={currentTrack.url} target="_blank" rel="noopener noreferrer" class="info-link track-title">
            {currentTrack.title}
          </a>
          <a
            href={currentTrack.url || currentTrack.user.profile}
            target="_blank"
            rel="noopener noreferrer"
            class="sc-track-link"
          >
            <img
              src="/logo_white-af5006050dd9cba09b0c48be04feac57.png"
              alt="Listen on SoundCloud"
              class="sc-track-logo"
            />
          </a>
        </div>
      {/if}
      {#if error}
        <div class="error-message">[{error}]</div>
      {/if}
      <a
        href="https://github.com/anirbanmu/vizl"
        target="_blank"
        rel="noopener noreferrer"
        class="source-link"
        aria-label="View Source"
      >
        .git
      </a>
    </div>

    <div class="viewport-area"></div>

    <div class="controls-dock">
      <div class="seek-bar-row">
        <SeekBar
          {currentTime}
          {duration}
          onseek={handleSeek}
          disabled={!(currentSource instanceof SoundCloudSource && currentTrack)}
        />
      </div>
      <div class="controls-cell">
        <PlayerControls {isPlaying} onplay={handlePlay} onstop={handleStop} />
      </div>
      <div class="input-cell">
        <TrackInput
          bind:value={trackUrl}
          onsubmit={handleTrackSubmit}
          disabled={isLoading}
          loading={isLoading}
          placeholder={isLoading ? 'resolving stream...' : undefined}
        />
      </div>
      <div class="attribution-cell">
        <a href="https://soundcloud.com" target="_blank" rel="noopener noreferrer" class="sc-link">
          <img
            src="/powered_by_white-371bd6967352fcc89673d4c81f7e5661.png"
            alt="Powered by SoundCloud"
            class="sc-logo"
          />
        </a>
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
    grid-template-rows: 60px 1fr auto;
    grid-template-columns: 1fr;
    pointer-events: none; /* let clicks pass through to visualizer layer by default */
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
    display: flex;
    align-items: center;
    margin: 0;
  }

  .header-logo {
    display: inline-block;
    height: 40px;
    width: 60px; /* approximate ratio for "Vizl." stack */
    background-color: var(--color-accent);

    /* create the shape using the logo as a mask */
    -webkit-mask-image: url('/logo.png');
    -webkit-mask-size: contain;
    -webkit-mask-repeat: no-repeat;
    -webkit-mask-position: center left;
    mask-image: url('/logo.png');
    mask-size: contain;
    mask-repeat: no-repeat;
    mask-position: center left;

    /* add the digital glow */
    filter: drop-shadow(0 0 4px var(--color-accent));
    opacity: 0.9;
  }

  .version {
    font-size: 0.75rem;
    color: var(--color-accent);
    margin-left: var(--spacing-sm);
    font-weight: 700;
  }

  .track-info {
    margin-left: var(--spacing-xl);
    display: flex;
    align-items: center;
    gap: var(--spacing-sm);
    font-family: var(--font-mono);
    font-size: 0.875rem;
    color: var(--color-fg);
  }

  .sc-track-link {
    display: flex;
    align-items: center;
    margin-left: var(--spacing-sm);
    opacity: 0.8;
    transition: opacity 0.2s ease;
  }

  .sc-track-link:hover {
    opacity: 1;
  }

  .sc-track-logo {
    height: 14px;
    display: block;
  }

  .info-link {
    text-decoration: none !important;
    opacity: 0.8;
    transition:
      opacity 0.2s ease,
      color 0.2s ease;
  }

  /* Specific Colors */
  .info-link.track-artist {
    color: #b3b3b3;
  }

  .info-link.track-title {
    color: var(--color-fg);
  }

  /* Hover State (Must come after specific colors to override without !important) */
  .info-link:hover {
    opacity: 1;
    color: var(--color-fg) !important;
  }

  .track-separator {
    color: var(--color-accent);
  }

  .error-message {
    margin-left: var(--spacing-xl);
    color: var(--color-accent);
    font-family: var(--font-mono);
    font-size: 0.875rem;
  }

  .source-link {
    margin-left: auto;
    font-family: var(--font-mono);
    font-size: 0.75rem;
    color: var(--color-fg);
    opacity: 0.5;
    text-decoration: none;
    transition: opacity 0.2s ease;
  }

  .source-link:hover {
    opacity: 1;
  }

  .viewport-area {
    grid-row: 2;
  }

  .controls-dock {
    grid-row: 3;
    display: grid;
    grid-template-rows: auto 1fr;
    grid-template-columns: auto 1fr auto;
    border-top: none;
    background: var(--color-bg);
    pointer-events: all;
    padding-bottom: var(--spacing-sm);
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

  .sc-link {
    display: flex;
    align-items: center;
  }

  .sc-logo {
    height: 32px;
    opacity: 0.8;
    transition: opacity 0.2s ease;
  }

  .sc-logo:hover {
    opacity: 1;
  }

  .seek-bar-row {
    grid-column: 1 / -1;
    padding: 0;
    display: flex;
    align-items: center;
    border-bottom: none;
  }
</style>
