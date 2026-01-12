<script lang="ts">
  interface Props {
    isPlaying: boolean;
    disabled?: boolean;
    autoplayBlocked?: boolean;
    onplay?: () => void;
    onstop?: () => void;
  }

  let { isPlaying, disabled = false, autoplayBlocked = false, onplay, onstop }: Props = $props();

  function handlePlayPause(): void {
    if (isPlaying) {
      onstop?.();
    } else {
      onplay?.();
    }
  }
</script>

<div class="player-controls">
  <button
    type="button"
    class="wireframe-btn"
    class:active={isPlaying}
    class:pulse={autoplayBlocked}
    onclick={handlePlayPause}
    {disabled}
    aria-label={isPlaying ? 'Stop' : 'Play'}
    style:min-width="100px"
  >
    {isPlaying ? '■ STOP' : '▶ PLAY'}
  </button>
</div>

<style>
  .player-controls {
    display: flex;
    gap: var(--spacing-sm);
    align-items: center;
  }

  .pulse {
    animation: pulse-animation 1.5s infinite;
    border-color: var(--color-accent);
  }

  @keyframes pulse-animation {
    0% {
      background: var(--color-bg);
      color: var(--color-fg);
    }
    50% {
      background: var(--color-accent);
      color: var(--color-bg);
    }
    100% {
      background: var(--color-bg);
      color: var(--color-fg);
    }
  }
</style>
