<script lang="ts">
  import type { TestAudioType } from '../audio/test-generator';

  interface Props {
    visible?: boolean;
    activeType: TestAudioType;
    onchange: (type: TestAudioType) => void;
  }

  let { visible = false, activeType, onchange }: Props = $props();

  const types: TestAudioType[] = ['sine', 'sweep', 'noise', 'beat'];
</script>

{#if visible}
  <div class="debug-panel">
    <div class="header">DEBUG / TEST TONES</div>
    <div class="grid">
      {#each types as type (type)}
        <button class:active={activeType === type} onclick={() => onchange(type)}>
          {type}
        </button>
      {/each}
    </div>
  </div>
{/if}

<style>
  .debug-panel {
    position: fixed;
    bottom: var(--spacing-lg);
    right: var(--spacing-lg);
    background: rgba(0, 0, 0, 0.9);
    border: var(--border-accent);
    padding: var(--spacing-md);
    z-index: 1000;
    min-width: 200px;
  }

  .header {
    color: var(--color-accent);
    font-size: 0.75rem;
    margin-bottom: var(--spacing-sm);
    letter-spacing: 0.1em;
    font-weight: bold;
    border-bottom: var(--border-muted);
    padding-bottom: var(--spacing-xs);
  }

  .grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: var(--spacing-xs);
  }

  button {
    background: transparent;
    border: var(--border-muted);
    color: var(--color-muted);
    padding: var(--spacing-xs) var(--spacing-sm);
    font-family: var(--font-mono);
    font-size: 0.75rem;
    text-align: left;
    cursor: pointer;
    text-transform: uppercase;
  }

  button:hover {
    border-color: var(--color-fg);
    color: var(--color-fg);
  }

  button.active {
    background: var(--color-accent);
    color: var(--color-bg);
    border-color: var(--color-accent);
  }
</style>
