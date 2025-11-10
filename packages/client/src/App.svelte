<script lang="ts">
  import type { Track } from '@common/track';
  import { AUDIO_CONFIG } from './audio/types';

  let count = $state(0);

  function increment(): void {
    count++;
  }

  // test @common imports - create a sample track
  const sampleTrack: Track = {
    streamUrl: 'https://example.com/stream',
    url: 'https://soundcloud.com/example',
    title: 'test track',
    artwork: null,
    user: {
      name: 'test user',
      profile: 'https://soundcloud.com/testuser'
    }
  };

  // test audio config import
  const fftSize: number = AUDIO_CONFIG.frequency.fftSize;
</script>

<main>
  <h1>vizl</h1>
  <p>hello world from svelte 5</p>

  <button onclick={increment}>
    count is {count}
  </button>

  <p>click the button to test svelte 5 reactivity</p>

  <div class="common-test">
    <h2>@common imports test</h2>
    <p><strong>track title:</strong> {sampleTrack.title}</p>
    <p><strong>track user:</strong> {sampleTrack.user.name}</p>
    <p><strong>audio fft size:</strong> {fftSize}</p>
    <p><strong>smoothing:</strong> {AUDIO_CONFIG.frequency.smoothingTimeConstant}</p>
  </div>
</main>

<style>
  main {
    text-align: center;
    padding: 2rem;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  }

  h1 {
    color: #333;
    margin-bottom: 1rem;
  }

  button {
    background: #007acc;
    color: white;
    border: none;
    padding: 0.5rem 1rem;
    border-radius: 4px;
    cursor: pointer;
    font-size: 1rem;
  }

  button:hover {
    background: #005a9e;
  }

  p {
    color: #666;
    margin: 1rem 0;
  }

  .common-test {
    margin-top: 2rem;
    padding: 1rem;
    border: 1px solid #ddd;
    border-radius: 4px;
    background: #f9f9f9;
  }

  .common-test h2 {
    color: #007acc;
    margin-bottom: 1rem;
    font-size: 1.2rem;
  }

  .common-test p {
    text-align: left;
    margin: 0.5rem 0;
  }
</style>