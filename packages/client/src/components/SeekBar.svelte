<script lang="ts">
  interface Props {
    currentTime: number;
    duration: number;
    disabled?: boolean;
    onseek?: (time: number) => void;
  }

  let { currentTime, duration, disabled = false, onseek }: Props = $props();

  let progressBar: HTMLDivElement;
  let isDragging = false;

  const progressPercent = $derived((duration > 0 ? currentTime / duration : 0) * 100);

  function handleSeek(event: MouseEvent) {
    if (disabled || !duration) return;

    const rect = progressBar.getBoundingClientRect();
    const x = Math.max(0, Math.min(event.clientX - rect.left, rect.width));
    const percent = x / rect.width;
    const time = percent * duration;

    onseek?.(time);
  }

  function handleMouseDown(event: MouseEvent) {
    if (disabled) return;
    isDragging = true;
    handleSeek(event);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  }

  function handleMouseMove(event: MouseEvent) {
    if (isDragging) {
      handleSeek(event);
    }
  }

  function handleMouseUp() {
    isDragging = false;
    window.removeEventListener('mousemove', handleMouseMove);
    window.removeEventListener('mouseup', handleMouseUp);
  }
</script>

<div
  class="seek-bar-container"
  class:disabled
  bind:this={progressBar}
  onmousedown={handleMouseDown}
  role="slider"
  aria-valuenow={currentTime}
  aria-valuemin="0"
  aria-valuemax={duration}
  tabindex={disabled ? -1 : 0}
>
  <div class="progress-track">
    <div class="progress-fill" style:width="{progressPercent}%"></div>
    <div class="progress-thumb" style:left="{progressPercent}%"></div>
  </div>
</div>

<style>
  .seek-bar-container {
    width: 100%;
    height: 10px;
    cursor: pointer;
    position: relative;
    display: flex;
    align-items: flex-start;
    padding: 0;
  }

  .seek-bar-container.disabled {
    cursor: default;
    pointer-events: none;
  }

  .seek-bar-container.disabled .progress-track {
    background: var(--color-muted);
    opacity: 0.5;
  }

  .seek-bar-container.disabled .progress-fill,
  .seek-bar-container.disabled .progress-thumb {
    opacity: 0;
  }

  .progress-track {
    width: 100%;
    height: 1px;
    background: var(--color-muted);
    position: relative;
    transition: height 0.1s ease;
  }

  .seek-bar-container:hover .progress-track {
    height: 2px;
  }

  .progress-fill {
    height: 100%;
    background: var(--color-accent);
    position: absolute;
    top: 0;
    left: 0;
  }

  .progress-thumb {
    width: 4px;
    height: 4px;
    background: var(--color-accent);
    border: none;
    position: absolute;
    top: 50%;
    transform: translate(-50%, -50%);
    z-index: 2;
    opacity: 0;
    transition:
      opacity 0.1s ease,
      transform 0.1s ease;
  }

  .seek-bar-container:hover .progress-thumb {
    opacity: 1;
    transform: translate(-50%, -50%) scale(1.5);
  }
</style>
