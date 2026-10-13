<script lang="ts">
  import { tick } from 'svelte';
  import type { VideoStory } from '@/types/campaign';
  import { getBackgroundStyle } from '@/lib/utils';
  import { deriveButtonUrl } from '@/lib/campaignCta';
  import { VIDEO_WIDGET as size } from '@/lib/videoStory/videoRules';
  import { campaignId, isClosed, rememberClosed, safeUrl, showsTimer, videoTimeLeft } from './logic';

  /**
   * The Video Story, as VideoStoryCanvas draws it: a 9:16 clip with the × on
   * its outer top corner, the countdown (time only) along its bottom edge, and
   * the call to action in a tray below so the clip is never covered.
   *
   * `bubble` (phones with the card also showing, see videoLayout): a 64px
   * round preview in the same corner that opens the full story in a centred
   * overlay; Esc, the × or a tap outside fold it back.
   */
  let { video, position, bubble = false }: { video: VideoStory; position: VideoStory['position']; bubble?: boolean } = $props();

  const id = $derived(campaignId(video, video.videoUrl));
  let closedNow = $state(false);
  const closed = $derived(closedNow || isClosed('video', id));
  const onLeft = $derived(position === 'bottom-left');
  const src = $derived(safeUrl(video.videoUrl));
  const timerOn = $derived(showsTimer(video));
  const buttonText = $derived((video.buttonText || '').trim());
  const href = $derived(safeUrl(deriveButtonUrl(video)));
  const b = $derived(video.buttonStyle);
  const ring = $derived(getBackgroundStyle(b.background));

  let sec = $state(0);
  $effect(() => {
    if (!timerOn) return;
    const t = setInterval(() => sec++, 1000);
    return () => clearInterval(t);
  });
  const left = $derived.by(() => (void sec, timerOn ? videoTimeLeft(video.endDate!) : ''));

  let open = $state(false);
  let muted = $state(true);
  let bubbleBtn: HTMLButtonElement | undefined = $state();
  let dialogClose: HTMLButtonElement | undefined = $state();

  async function expand() {
    open = true;
    await tick();
    dialogClose?.focus();
  }
  async function collapse() {
    open = false;
    muted = true;
    await tick();
    bubbleBtn?.focus();
  }
  function close() {
    open = false;
    closedNow = true;
    rememberClosed('video', id);
  }
</script>

<svelte:window onkeydown={(e) => open && e.key === 'Escape' && collapse()} />

{#snippet cta(big: boolean)}
  {#if video.showButton && buttonText}
    <div class="tray" style:height="{big ? 64 : size.trayHeight}px">
      <a
        class="btn"
        class:big
        href={href || undefined}
        target={href ? '_blank' : undefined}
        rel={href ? 'noopener noreferrer' : undefined}
        style:background={ring}
        style:color={b.textColor}
        style:text-align={b.textAlign || 'center'}
      >{buttonText}</a>
    </div>
  {/if}
{/snippet}

{#if !closed && src}
  {#if !bubble}
    <div class="story" class:onLeft style:width="{size.width}px" role="complementary" aria-label="Video story">
      <div class="clip" style:height="{size.videoHeight}px">
        <video {src} muted autoplay loop playsinline preload="metadata"></video>
        <button class="close" type="button" aria-label="Close" onclick={close}>&times;</button>
        {#if timerOn}
          <span class="time" style:color={video.timerTextColor}>{left}</span>
        {/if}
      </div>
      {@render cta(false)}
    </div>
  {:else}
    <div class="bubble" class:onLeft style:background={ring}>
      <button bind:this={bubbleBtn} class="face" type="button" aria-label="Play video story" aria-haspopup="dialog" onclick={expand}>
        <video {src} muted autoplay loop playsinline preload="metadata"></video>
        <span class="play" aria-hidden="true"></span>
      </button>
      <button class="x" type="button" aria-label="Close video story" onclick={close}>&times;</button>
    </div>
    {#if open}
      <div class="scrim" role="presentation" onclick={(e) => e.target === e.currentTarget && collapse()}>
        <div class="sheet" role="dialog" aria-modal="true" aria-label="Video story">
          <div class="clip">
            <video {src} bind:muted autoplay loop playsinline></video>
            <button bind:this={dialogClose} class="close" type="button" aria-label="Back" onclick={collapse}>&times;</button>
            <button class="close sound" type="button" aria-label={muted ? 'Unmute' : 'Mute'} onclick={() => (muted = !muted)}>{muted ? '🔇' : '🔊'}</button>
            {#if timerOn}
              <span class="time" style:color={video.timerTextColor}>{left}</span>
            {/if}
          </div>
          {@render cta(true)}
        </div>
      </div>
    {/if}
  {/if}
{/if}

<style>
  .story {
    position: fixed;
    z-index: 99998;
    bottom: 24px;
    right: 24px;
    box-sizing: border-box;
    animation: in 0.5s ease both;
  }
  .story.onLeft { right: auto; left: 24px; }
  .story * { box-sizing: border-box; }
  /* Phones: a smaller clip, so the card fits in the other corner. */
  @media (max-width: 640px) {
    .story { bottom: 16px; right: 16px; zoom: 0.55; }
    .story.onLeft { left: 16px; }
  }
  @keyframes in {
    from { opacity: 0; transform: translateY(20px) scale(0.95); }
    to { opacity: 1; transform: none; }
  }
  @media (prefers-reduced-motion: reduce) {
    .story { animation: none; }
  }
  .clip {
    position: relative;
    overflow: hidden;
    border-radius: 16px;
    background: #000;
    box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
  }
  video {
    display: block;
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
  .close {
    position: absolute;
    top: 8px;
    right: 8px;
    display: grid;
    place-items: center;
    width: 28px;
    height: 28px;
    padding: 0;
    border: none;
    border-radius: 50%;
    background: rgba(0, 0, 0, 0.55);
    color: #fff;
    font: 18px/1 sans-serif;
    cursor: pointer;
    backdrop-filter: blur(12px);
  }
  .onLeft .close { right: auto; left: 8px; }
  .time {
    position: absolute;
    left: 8px;
    right: 8px;
    bottom: 8px;
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
    text-align: center;
    font-size: 14px;
    line-height: 20px;
    font-weight: 600;
    font-variant-numeric: tabular-nums;
    text-shadow: 0 1px 3px rgba(0, 0, 0, 0.45);
    pointer-events: none;
  }
  .tray { display: flex; align-items: center; }
  .btn {
    display: block;
    width: 100%;
    height: 40px;
    padding: 0 12px;
    border-radius: 8px;
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
    font-size: 14px;
    line-height: 40px;
    font-weight: 600;
    text-decoration: none;
    box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -4px rgba(0, 0, 0, 0.1);
  }
  /* ---- Bubble (phone, card also showing) ---- */
  .bubble {
    position: fixed;
    z-index: 99998;
    bottom: 16px;
    right: 16px;
    width: 64px;
    height: 64px;
    padding: 3px;
    box-sizing: border-box;
    border-radius: 50%;
    box-shadow: 0 8px 20px rgba(0, 0, 0, 0.25);
    animation: in 0.4s ease both, pulse 1.2s ease-out 0.4s 1;
  }
  .bubble.onLeft { right: auto; left: 16px; }
  @keyframes pulse {
    from { box-shadow: 0 8px 20px rgba(0, 0, 0, 0.25), 0 0 0 0 rgba(255, 255, 255, 0.7); }
    to { box-shadow: 0 8px 20px rgba(0, 0, 0, 0.25), 0 0 0 14px rgba(255, 255, 255, 0); }
  }
  @media (prefers-reduced-motion: reduce) {
    .bubble { animation: none; }
  }
  .face {
    box-sizing: border-box;
    position: relative;
    display: block;
    width: 100%;
    height: 100%;
    padding: 0;
    border: 2px solid #fff;
    border-radius: 50%;
    overflow: hidden;
    background: #000;
    cursor: pointer;
  }
  .play {
    position: absolute;
    left: 50%;
    top: 50%;
    width: 20px;
    height: 20px;
    margin: -10px 0 0 -10px;
    border-radius: 50%;
    background: rgba(0, 0, 0, 0.5);
  }
  .play::after {
    content: '';
    position: absolute;
    left: 8px;
    top: 6px;
    border-left: 6px solid #fff;
    border-top: 4px solid transparent;
    border-bottom: 4px solid transparent;
  }
  .x {
    position: absolute;
    top: -4px;
    right: -4px;
    width: 22px;
    height: 22px;
    padding: 0;
    border: none;
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.95);
    color: #333;
    font: 15px/1 sans-serif;
    box-shadow: 0 1px 4px rgba(0, 0, 0, 0.3);
    cursor: pointer;
  }
  .onLeft .x { right: auto; left: -4px; }

  /* ---- Overlay: the card stays put underneath the scrim ---- */
  .scrim {
    position: fixed;
    inset: 0;
    z-index: 99999;
    display: grid;
    place-items: center;
    background: rgba(0, 0, 0, 0.6);
  }
  .sheet { width: min(calc((85vh - 64px) * 9 / 16), calc(100vw - 32px)); }
  .sheet .clip { aspect-ratio: 9 / 16; }
  .sound { right: auto; left: 8px; font-size: 14px; }
  .btn.big { height: 48px; line-height: 48px; font-size: 16px; }
</style>
