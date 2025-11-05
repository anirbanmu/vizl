<script lang="ts">
  import type { Track } from '@vizl/common';

  // proof-of-concept: verify cross-package imports work
  const exampleTrack: Track = {
    streamUrl: 'https://example.com/stream',
    url: 'https://soundcloud.com/example',
    title: 'Example Track',
    artwork: null,
    user: {
      name: 'Example Artist',
      profile: 'https://soundcloud.com/artist'
    }
  };
</script>

<main>
  <h1>vizl music visualizer</h1>
  <p>hello world - client package is working!</p>
  <p>shared types working: {exampleTrack.title} by {exampleTrack.user.name}</p>
</main>

<style>
  main {
    text-align: center;
    padding: 2rem;
  }
  
  h1 {
    color: #ff3e00;
    margin-bottom: 1rem;
  }
</style>