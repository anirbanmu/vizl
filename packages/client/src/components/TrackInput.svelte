<script lang="ts">
  interface Props {
    value?: string;
    placeholder?: string;
    disabled?: boolean;
    onsubmit?: (url: string) => void;
  }

  let { value = $bindable(''), placeholder = 'paste soundcloud url...', disabled = false, onsubmit }: Props = $props();

  function handleKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter' && value.trim() && onsubmit) {
      onsubmit(value.trim());
    }
  }

  function handleSubmit(): void {
    if (value.trim() && onsubmit) {
      onsubmit(value.trim());
    }
  }
</script>

<div class="track-input-container">
  <input type="text" class="track-input" bind:value {placeholder} {disabled} onkeydown={handleKeydown} />
  <button
    type="button"
    class="submit-btn"
    onclick={handleSubmit}
    disabled={disabled || !value.trim()}
    aria-label="Load track"
  >
    →
  </button>
</div>

<style>
  .track-input-container {
    display: flex;
    gap: 0;
    width: 100%;
    max-width: 500px;
  }

  .track-input {
    flex: 1;
    background: var(--color-bg);
    color: var(--color-fg);
    border: var(--border-default);
    padding: var(--spacing-sm) var(--spacing-md);
    font-family: var(--font-mono);
    font-size: 0.875rem;
    outline: none;
    transition: none;
  }

  .track-input::placeholder {
    color: var(--color-muted);
    text-transform: lowercase;
  }

  .track-input:focus {
    background: var(--color-fg);
    color: var(--color-bg);
    border-color: var(--color-fg);
  }

  .track-input:focus::placeholder {
    color: var(--color-muted);
  }

  .track-input:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .submit-btn {
    background: var(--color-bg);
    color: var(--color-fg);
    border: var(--border-default);
    border-left: none;
    padding: var(--spacing-sm) var(--spacing-md);
    font-family: var(--font-mono);
    font-size: 1rem;
    cursor: pointer;
    transition: none;
  }

  .submit-btn:hover:not(:disabled) {
    background: var(--color-fg);
    color: var(--color-bg);
  }

  .submit-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
</style>
