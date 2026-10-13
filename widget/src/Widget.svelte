<svelte:options
  customElement={{
    tag: 'campaign-widget',
    shadow: 'open',
    props: { config: { type: 'Object' }, src: { type: 'String' } },
  }}
/>

<script lang="ts">
  import type { CampaignConfig } from '@/types/campaign';
  import { campaignId, decide, isClosed, videoLayout } from './logic';
  import Bar from './Bar.svelte';
  import SmartCard from './SmartCard.svelte';
  import VideoStory from './VideoStory.svelte';

  // `config` (a JS property) wins: the admin preview feeds live edits through it.
  // Otherwise the published JSON is fetched from `src`.
  let { config = undefined, src = '' }: { config?: CampaignConfig; src?: string } = $props();
  let fetched: CampaignConfig | undefined = $state();
  let now = $state(new Date());

  $effect(() => {
    if (config || !src) return;
    fetch(src, { cache: 'no-cache', headers: { Accept: 'application/json' } })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((d) => (fetched = d))
      .catch((e) => console.warn('[campaign-widget] could not load', src, e?.message ?? e));
  });

  // Schedules turn over at midnight; a tab left open picks that up within a minute.
  $effect(() => {
    const t = setInterval(() => (now = new Date()), 60_000);
    return () => clearInterval(t);
  });

  const plan = $derived(decide(config ?? fetched, now));
  // The card counts as showing until it is closed, this visit or earlier in the session.
  let cardClosed = $state(false);
  const cardShown = $derived(!!plan.card && !cardClosed && !isClosed('card', campaignId(plan.card, plan.card.title)));
  let vw = $state(typeof innerWidth === 'number' ? innerWidth : 1024);
  const both = $derived(cardShown && !!plan.video);
</script>

<svelte:window bind:innerWidth={vw} />

<svelte:boundary onerror={(e) => console.warn('[campaign-widget]', e)}>
  {#if plan.messages.length}
    <Bar bar={(config ?? fetched)!.announcementBar} messages={plan.messages} />
  {/if}
  {#if plan.card}
    <SmartCard card={plan.card} position={plan.cardPosition} {both} onclose={() => (cardClosed = true)} />
  {/if}
  {#if plan.video}
    <VideoStory video={plan.video} position={plan.videoPosition} bubble={videoLayout(cardShown, vw) === 'bubble'} />
  {/if}
  {#snippet failed()}{/snippet}
</svelte:boundary>

<style>
  /* Nothing the host page sets (font, letter-spacing, line-height…) leaks in. */
  :host {
    all: initial;
    display: block;
    font-family: -apple-system, BlinkMacSystemFont, system-ui, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
  }
</style>
