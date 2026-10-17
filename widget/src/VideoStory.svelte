<script lang="ts">
  import { tick } from 'svelte';
  import type { VideoStory } from '@/types/campaign';
  import { getBackgroundStyle } from '@/lib/utils';
  import { deriveButtonUrl } from '@/lib/campaignCta';
  import { VIDEO_WIDGET as size } from '@/lib/videoStory/videoRules';
  import { fitTitleToTwoLines, VIDEO_TITLE_LOOK, videoTimerColor, videoTitle } from '@/lib/videoStory/videoTitle';
  import { campaignId, isClosed, rememberClosed, safeUrl, sanitize, showsTimer, videoTimeLeft } from './logic';

  /**
   * The Video Story, as VideoStoryCanvas draws it: a 9:16 clip with the × on
   * its outer top corner, the title along its top edge, the countdown (time
   * only) along its bottom edge, and
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
  // The widget and the bubble play the small preview copy (under 1 MB); the
  // full clip loads only when the large view opens. Older stories have none.
  const small = $derived(safeUrl(video.previewUrl ?? '') || src);
  let loading = $state(true);
  const timerOn = $derived(showsTimer(video));
  const buttonText = $derived((video.buttonText || '').trim());
  const href = $derived(safeUrl(deriveButtonUrl(video)));
  const b = $derived(video.buttonStyle);
  // The phone bubble's ring; a see-through button has no fill, so it takes the text colour.
  const ring = $derived(b.background.type === 'transparent' ? b.textColor : getBackgroundStyle(b.background));
  // Svelte escapes {text}, so the title stays plain text: no HTML runs.
  const title = $derived(videoTitle(video));
  // White or black, like the title, with its matching shadow.
  /** Svelte action: fit the title to two lines now and whenever its text changes. */
  function fit(el: HTMLElement, _text: string) {
    fitTitleToTwoLines(el);
    return { update: () => fitTitleToTwoLines(el) };
  }
  const timerLook = $derived(VIDEO_TITLE_LOOK[videoTimerColor(video)]);

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
  let expandBtn: HTMLButtonElement | undefined = $state();
  let dialogClose: HTMLButtonElement | undefined = $state();

  async function expand() {
    loading = true;
    open = true;
    await tick();
    dialogClose?.focus();
  }
  async function collapse() {
    open = false;
    muted = true;
    await tick();
    // Back to whichever control opened it.
    (bubble ? bubbleBtn : expandBtn)?.focus();
  }
  function close() {
    open = false;
    closedNow = true;
    rememberClosed('video', id);
  }
</script>

<svelte:window onkeydown={(e) => open && e.key === 'Escape' && collapse()} />

{#snippet heading()}
  {#if title.html}
    <div class="title" style:background={title.look.shade}>
      <p use:fit={title.html} style:color={title.look.color} style:text-shadow={title.look.shadow} style:text-align={title.align}>
        <!-- Rich text, so it goes through sanitize like the Smart Card's fields. -->
        {@html sanitize(title.html)}
      </p>
    </div>
  {/if}
{/snippet}

{#snippet cta(big: boolean)}
  {#if video.showButton && buttonText}
    <div class="tray" style:height="{big ? 64 : size.trayHeight}px">
      <a
        class="btn"
        class:big
        href={href || undefined}
        target={href ? '_blank' : undefined}
        rel={href ? 'noopener noreferrer' : undefined}
        style:background={getBackgroundStyle(b.background)}
        style:box-shadow={b.background.type === 'transparent' ? 'none' : undefined}
        style:color={b.textColor}
        style:text-align={b.textAlign || 'center'}
      >{buttonText}</a>
    </div>
  {/if}
{/snippet}

{#if !closed && src}
  {#if !bubble}
    <div class="story" class:onLeft style:width="{size.width}px" role="complementary" aria-label="Video story">
      <!-- A click anywhere on the video opens the large view; keyboard users have the expand button. -->
      <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
      <div class="clip open-on-click" style:height="{size.videoHeight}px" onclick={expand}>
        <video src={small} muted autoplay loop playsinline preload="metadata"></video>
        {@render heading()}
        {#if timerOn}
          <span class="time" style:color={timerLook.color} style:text-shadow={timerLook.shadow}>{left}</span>
        {/if}
        <!-- Top-left corner, opposite the close; opens the large view with sound. -->
        <button bind:this={expandBtn} class="hover-btn expand" type="button" aria-label="Open video" aria-haspopup="dialog" onclick={expand}>
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8 3H5a2 2 0 0 0-2 2v3M21 8V5a2 2 0 0 0-2-2h-3M3 16v3a2 2 0 0 0 2 2h3M16 21h3a2 2 0 0 0 2-2v-3"/></svg>
        </button>
      </div>
      <!-- Inside the top-right corner, shown on hover; always shown on touch screens. -->
      <button class="hover-btn dismiss" type="button" aria-label="Close" onclick={close}>&times;</button>
      {@render cta(false)}
    </div>
  {:else}
    <div class="bubble" class:onLeft style:background={ring}>
      <button bind:this={bubbleBtn} class="face" type="button" aria-label="Play video story" aria-haspopup="dialog" onclick={expand}>
        <video src={small} muted autoplay loop playsinline preload="metadata"></video>
        <span class="play" aria-hidden="true"></span>
      </button>
      <button class="x" type="button" aria-label="Close video story" onclick={close}>&times;</button>
    </div>
  {/if}
  {#if open}
    <div class="scrim" role="presentation" onclick={(e) => e.target === e.currentTarget && collapse()}>
      <div class="sheet" role="dialog" aria-modal="true" aria-label="Video story">
        <div class="clip">
          <video {src} bind:muted autoplay loop playsinline onloadstart={() => (loading = true)} oncanplay={() => (loading = false)}></video>
          {#if loading}<span class="spinner" aria-label="Loading video" role="status"></span>{/if}
          {@render heading()}
          <button bind:this={dialogClose} class="close" type="button" aria-label="Back" onclick={collapse}>&times;</button>
          <button class="close sound" type="button" aria-label={muted ? 'Unmute' : 'Mute'} onclick={() => (muted = !muted)}>{muted ? '🔇' : '🔊'}</button>
          {#if timerOn}
            <span class="time" style:color={timerLook.color} style:text-shadow={timerLook.shadow}>{left}</span>
          {/if}
        </div>
        {@render cta(true)}
      </div>
    </div>
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
  /* The two buttons in the video's top corners, expand and close: white
     circles that appear on hover, and always on touch screens (no hover). */
  .hover-btn {
    position: absolute;
    top: 6px;
    z-index: 1;
    display: grid;
    place-items: center;
    width: 24px;
    height: 24px;
    padding: 0;
    border: none;
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.9);
    color: #000;
    font: 16px/1 sans-serif;
    cursor: pointer;
    opacity: 0;
    transition: opacity 0.2s;
  }
  .expand { left: 6px; }
  .dismiss { right: 6px; }
  .story:hover .hover-btn,
  .hover-btn:focus-visible { opacity: 1; }
  @media (hover: none) {
    .hover-btn { opacity: 1; }
  }
  .open-on-click { cursor: pointer; }
  /* Shown in the large view until the full clip can play. */
  .spinner {
    position: absolute;
    top: 50%;
    left: 50%;
    width: 36px;
    height: 36px;
    margin: -18px 0 0 -18px;
    border: 3px solid rgba(255, 255, 255, 0.35);
    border-top-color: #fff;
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }
  @keyframes spin { to { transform: rotate(360deg); } }
  @media (prefers-reduced-motion: reduce) {
    .spinner { animation-duration: 2s; }
  }
  /* A soft dim on hover, so the white buttons sit on a calmer picture. Under
     the title and countdown, which sit above it. */
  .story .clip::after {
    content: '';
    position: absolute;
    inset: 0;
    background: rgba(0, 0, 0, 0);
    transition: background 0.2s;
    pointer-events: none;
  }
  .story:hover .clip::after { background: rgba(0, 0, 0, 0.25); }
  .story .clip .title,
  .story .clip .time { z-index: 1; }
  @media (prefers-reduced-motion: reduce) {
    .story .clip::after { transition: none; }
  }
  /* The expanded video keeps its close and sound buttons inside the top edge. */
  .sheet .title { padding-top: 44px; }
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
  /* VideoStoryCanvas's title: 36px clear each side for the close button. */
  .title {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    /* 8px from the top, fixed. Both lines the same width, 36px in from each
       side, clear of the hover buttons. */
    padding: 8px 36px 24px;
    pointer-events: none;
  }
  .title p {
    margin: 0;
    overflow-wrap: break-word;
    /* Base size; words can be bigger or smaller (rich text), and
       fitTitleToTwoLines scales the whole title down so it never needs an ellipsis. */
    font-size: 14px;
    line-height: 1.4;
    /* Medium, so Bold in the editor (700) shows as a real step up. */
    font-weight: 500;
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
