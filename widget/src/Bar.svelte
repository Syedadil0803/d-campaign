<script lang="ts">
  import type { Announcement, CampaignConfig } from '@/types/campaign';
  import { getBackgroundStyle } from '@/lib/utils';
  import { DEFAULT_PX_PER_SEC, marqueeDurationSeconds } from '@/lib/announcement/scrollSpeed';
  import { dwellSeconds } from '@/lib/announcement/barMotion';
  import { safeUrl, sanitize } from './logic';

  /**
   * The Broadcasts bar: AnnouncementBarPreview (Scroll) and AnnouncementRotator
   * (Slide / Roll up / Fade), with useMarqueeLayout's measuring ported to an
   * effect. Same 40px bar, 14px/500 text, 16px either side of each message.
   */
  let { bar, messages }: { bar: CampaignConfig['announcementBar']; messages: Announcement[] } = $props();

  const reduced = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const loop = $derived(bar.loop !== false);
  const pxPerSec = $derived(bar.speed ?? DEFAULT_PX_PER_SEC);
  const motion = $derived(bar.motion ?? 'scroll');
  const bg = $derived(getBackgroundStyle(bar.style.background));

  // ---- Scroll (marquee) ----
  // Paused (speed 0) or reduced motion: one still copy, centred when it fits.
  const still = $derived(pxPerSec <= 0 || reduced);
  let width = $state(0);
  let track: HTMLElement | undefined = $state();
  let copies = $state(1);
  let duration = $state(0);
  const sets = $derived(still ? 1 : loop ? copies * 2 : 2);

  $effect(() => {
    void messages;
    if (!track || still || width <= 0) return;
    const half = track.scrollWidth / 2;
    if (half <= 0) return;
    if (loop) {
      const needed = Math.max(1, Math.ceil(width / (half / copies)));
      if (needed !== copies) copies = needed;
    }
    duration = marqueeDurationSeconds(half, pxPerSec);
  });

  // ---- Slide / Roll up / Fade: one at a time, hover holds ----
  let index = $state(0);
  let previous: number | null = $state(null);
  let hovered = $state(false);
  const current = $derived(messages.length ? index % messages.length : 0);
  const seconds = $derived(dwellSeconds(pxPerSec));

  $effect(() => {
    if (motion === 'scroll' || messages.length < 2 || seconds === 0 || hovered) return;
    const from = current;
    const t = setTimeout(() => {
      previous = from;
      index = (from + 1) % messages.length;
    }, seconds * 1000);
    return () => clearTimeout(t);
  });
</script>

{#snippet message(a: Announcement)}
  {@const href = safeUrl(a.url)}
  {#if href}
    <a class="ul" {href} target={a.openInNewTab ? '_blank' : undefined} rel="noopener noreferrer">{@html sanitize(a.text)}</a>
  {:else}
    <span>{@html sanitize(a.text)}</span>
  {/if}
{/snippet}

<div class="bar" style:background={bg} style:color={bar.style.textColor} role="region" aria-label="Announcements">
  {#if motion === 'scroll'}
    <div class="marquee" class:still bind:clientWidth={width}>
      <div class="track" bind:this={track} style:--d="{duration}s" class:run={!still && duration > 0}>
        {#each { length: sets } as _, s (s)}
          <span class="set" style:min-width={!loop && !still ? `${width}px` : undefined}>
            {#each messages as a, i (i)}<span class="item">{@render message(a)}</span>{/each}
          </span>
        {/each}
      </div>
    </div>
  {:else}
    <div class="rotator" role="presentation" onmouseenter={() => (hovered = true)} onmouseleave={() => (hovered = false)}>
      {#if previous !== null && previous !== current && previous < messages.length}
        {#key previous}<span class="slot out {motion}-out">{@render message(messages[previous])}</span>{/key}
      {/if}
      {#key current}<span class="slot {previous === null ? '' : `in ${motion}-in`}">{@render message(messages[current])}</span>{/key}
    </div>
  {/if}
</div>

<style>
  .bar {
    height: 40px;
    width: 100%;
    overflow: hidden;
    font-size: 14px;
    line-height: 20px;
    font-weight: 500;
    box-sizing: border-box;
  }
  .bar :global(b),
  .bar :global(strong) { font-weight: 700; }
  .marquee {
    display: flex;
    align-items: center;
    height: 100%;
    overflow: hidden;
  }
  .marquee.still { justify-content: safe center; }
  .track {
    display: inline-flex;
    white-space: nowrap;
  }
  .track.run { animation: scroll var(--d) linear infinite; }
  .marquee:hover .track { animation-play-state: paused; }
  @keyframes scroll {
    from { transform: translateX(0); }
    to { transform: translateX(-50%); }
  }
  .set {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }
  .item { display: inline-block; padding: 0 16px; }
  a { color: inherit; }

  .rotator {
    position: relative;
    height: 100%;
    width: 100%;
    overflow: hidden;
  }
  .slot {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0 16px;
    min-width: 0;
  }
  .slot > * {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    max-width: 100%;
  }
  .slot > a { display: inline-block; overflow: visible; }

  /* The admin's bar-* keyframes (globals.css). */
  @keyframes slideIn { from { transform: translateX(100%); opacity: 0; } to { transform: none; opacity: 1; } }
  @keyframes slideOut { from { transform: none; opacity: 1; } to { transform: translateX(-100%); opacity: 0; } }
  @keyframes rollIn { from { transform: translateY(100%); } to { transform: none; } }
  @keyframes rollOut { from { transform: none; } to { transform: translateY(-100%); } }
  @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
  @keyframes fadeOut { from { opacity: 1; } to { opacity: 0; } }
  .slot.slide-in { animation: slideIn 500ms ease-out both; }
  .slot.slide-out { animation: slideOut 500ms ease-in both; }
  .slot.rollup-in { animation: rollIn 450ms ease-out both; }
  .slot.rollup-out { animation: rollOut 450ms ease-in both; }
  .slot.fade-in { animation: fadeIn 300ms ease-out both; }
  .slot.fade-out { animation: fadeOut 300ms ease-in both; }
  @media (prefers-reduced-motion: reduce) {
    .slot.in { animation: fadeIn 200ms both; }
    .slot.out { animation: fadeOut 200ms both; }
  }

  /* The admin's animated-underline on linked messages. */
  .ul {
    position: relative;
    text-decoration: none;
  }
  .ul::after {
    content: '';
    position: absolute;
    left: 0;
    bottom: -5px;
    width: 100%;
    height: 3px;
    background: linear-gradient(90deg, #ea4335 0%, #4285f4 25%, #34a853 50%, #fbbc05 75%, #ea4335 100%);
    background-size: 300% 100%;
    animation: flow 4s linear infinite;
    border-radius: 999px;
    box-shadow: 0 0 8px rgba(234, 67, 53, 0.35), 0 0 10px rgba(66, 133, 244, 0.3), 0 0 12px rgba(52, 168, 83, 0.3), 0 0 14px rgba(251, 188, 5, 0.3);
  }
  @keyframes flow { from { background-position: 0% 0; } to { background-position: 300% 0; } }
  @media (prefers-reduced-motion: reduce) {
    .ul::after { animation: none; }
  }
</style>
