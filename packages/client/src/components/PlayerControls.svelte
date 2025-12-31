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
    class="wireframe-btn"
    class:active={isPlaying}
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
</style>
