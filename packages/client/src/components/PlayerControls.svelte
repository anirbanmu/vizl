<script lang="ts">
  interface Props {
    isPlaying: boolean;
    disabled?: boolean;
    onplay?: () => void;
    onstop?: () => void;
  }

  let { isPlaying, disabled = false, onplay, onstop }: Props = $props();

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
    class="control-btn"
    class:active={isPlaying}
    onclick={handlePlayPause}
    {disabled}
    aria-label={isPlaying ? 'Stop' : 'Play'}
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

  .control-btn {
    background: var(--color-bg);
    color: var(--color-fg);
    border: var(--border-default);
    padding: var(--spacing-sm) var(--spacing-md);
    font-family: var(--font-mono);
    font-size: 0.875rem;
    text-transform: uppercase;
    letter-spacing: 0.05rem;
    cursor: pointer;
    min-width: 100px;
    transition: none;
  }

  .control-btn:hover:not(:disabled) {
    background: var(--color-fg);
    color: var(--color-bg);
  }

  .control-btn.active {
    background: var(--color-accent);
    color: var(--color-bg);
    border-color: var(--color-accent);
  }

  .control-btn.active:hover:not(:disabled) {
    background: var(--color-fg);
    color: var(--color-bg);
    border-color: var(--color-fg);
  }

  .control-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
</style>
