<script lang="ts">
  interface Props {
    value?: string;
    placeholder?: string;
    disabled?: boolean;
    onsubmit?: (url: string) => void;
    loading?: boolean;
  }

  let {
    value = $bindable(''),
    placeholder = 'paste soundcloud url...',
    disabled = false,
    loading = false,
    onsubmit,
  }: Props = $props();

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
  <input
    type="text"
    class="wireframe-input track-input-override"
    bind:value
    {placeholder}
    {disabled}
    onkeydown={handleKeydown}
  />
  <button
    type="button"
    class="wireframe-btn submit-btn-override"
    onclick={handleSubmit}
    disabled={disabled || (!value.trim() && !loading)}
    aria-label="Load track"
  >
    {#if loading}
      <span class="spinner">/</span>
    {:else}
      →
    {/if}
  </button>
</div>

<style>
  .track-input-container {
    display: flex;
    gap: 0;
    width: 100%;
    max-width: 500px;
  }

  .track-input-override {
    flex: 1;
  }

  .submit-btn-override {
    border-left: none;
    font-size: 1rem;
    padding-left: var(--spacing-md);
    padding-right: var(--spacing-md);
  }

  .spinner {
    display: inline-block;
    animation: rotate 1s linear infinite;
  }

  @keyframes rotate {
    from {
      transform: rotate(0deg);
    }
    to {
      transform: rotate(360deg);
    }
  }
</style>
