<script lang="ts">
  import type { PromoCard } from '@/types/campaign';
  import { getBackgroundStyle } from '@/lib/utils';
  import { deriveButtonUrl } from '@/lib/campaignCta';
  import { campaignId, cardTimerHtml, hasText, isClosed, rememberClosed, safeUrl, sanitize, showsTimer } from './logic';

  /**
   * The Smart Card, as PromoCanvas draws it: 20px padding, rounded-xl, the
   * card's width, three text fields (title / subtitle centred, description
   * left by default), the countdown, then the button. The × is the live
   * site's (the editor has none).
   */
  let { card, position, both = false, onclose }: { card: PromoCard; position: PromoCard['style']['position']; both?: boolean; onclose?: () => void } = $props();

  const id = $derived(campaignId(card, card.title));
  let closedNow = $state(false);
  const closed = $derived(closedNow || isClosed('card', id));
  const s = $derived(card.style);
  const fields = $derived([
    { html: card.title, st: s.titleStyle, align: 'center', gap: 4 },
    { html: card.subtitle, st: s.subheadingStyle, align: 'center', gap: 8 },
    { html: card.description, st: s.descriptionStyle, align: 'left', gap: 8 },
  ]);
  const timerOn = $derived(showsTimer(card));
  const href = $derived(safeUrl(deriveButtonUrl(card)));
  const buttonOn = $derived(card.showButton && hasText(card.buttonText));
  const btnAlign = $derived(s.buttonStyle.textAlign || 'center');

  let tick = $state(0);
  $effect(() => {
    if (!timerOn) return;
    const t = setInterval(() => tick++, 1000);
    return () => clearInterval(t);
  });
  const timer = $derived.by(() => (void tick, timerOn ? cardTimerHtml(card) : ''));

  function close() {
    closedNow = true;
    rememberClosed('card', id);
    onclose?.();
  }
</script>

{#if !closed}
  <div
    class="card {position}"
    class:both
    style:--w="{card.cardWidth || 400}px"
    style:background={getBackgroundStyle(s.background)}
    style:color={s.textColor}
    role="complementary"
    aria-label="Offer"
  >
    <button class="close" type="button" aria-label="Close" onclick={close}>&times;</button>
    {#each fields as f}
      {#if hasText(f.html)}
        <div
          class="field"
          style:margin-bottom="{f.gap}px"
          style:background={getBackgroundStyle(f.st.background)}
          style:color={f.st.textColor}
          style:text-align={f.st.textAlign || f.align}
        >
          {@html sanitize(f.html)}
        </div>
      {/if}
    {/each}
    {#if timerOn}
      <div
        class="field timer"
        style:background={getBackgroundStyle(s.dateStyle.background)}
        style:color={s.dateStyle.textColor}
        style:text-align={s.dateStyle.textAlign || 'center'}
      >
        {@html timer}
      </div>
    {/if}
    {#if buttonOn}
      <div class="btn-row" style:justify-content={btnAlign === 'left' ? 'flex-start' : btnAlign === 'right' ? 'flex-end' : 'center'}>
        <a
          class="btn"
          class:full={card.buttonFullWidth}
          href={href || undefined}
          target={href ? '_blank' : undefined}
          rel={href ? 'noopener noreferrer' : undefined}
          style:background={getBackgroundStyle(s.buttonStyle.background)}
          style:color={s.buttonStyle.textColor}
          style:text-align={btnAlign}
          style:cursor={href ? 'pointer' : 'default'}
        >
          {@html sanitize(card.buttonText)}
        </a>
      </div>
    {/if}
  </div>
{/if}

<style>
  .card {
    position: fixed;
    z-index: 99998;
    box-sizing: border-box;
    width: min(var(--w), calc(100vw - 32px));
    padding: 20px;
    border-radius: 12px;
    font-size: 16px;
    line-height: 24px;
    font-weight: 400;
    display: flex;
    flex-direction: column;
    box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
    animation: in 0.5s ease both;
  }
  .card * { box-sizing: border-box; }
  .card :global(b),
  .card :global(strong) { font-weight: 700; }
  .card :global(a) { color: inherit; }
  .bottom-right { bottom: 24px; right: 24px; }
  .bottom-left { bottom: 24px; left: 24px; }
  .top-right { top: 60px; right: 24px; }
  .top-left { top: 60px; left: 24px; }
  /* Phones: the card leaves room for the video bubble in the other corner. */
  @media (max-width: 640px) {
    .card { bottom: 16px; }
    .bottom-right, .top-right { right: 16px; }
    .bottom-left, .top-left { left: 16px; }
    .card.both { width: min(var(--w), calc(100vw - 32px - 76px)); }
    /* Too narrow to hold the countdown on one line: let it wrap rather than cut. */
    .card .timer { white-space: normal; }
  }
  @keyframes in {
    from { opacity: 0; transform: translateY(20px) scale(0.95); }
    to { opacity: 1; transform: none; }
  }
  @media (prefers-reduced-motion: reduce) {
    .card { animation: none; }
  }
  .field {
    padding: 4px 8px;
    border-radius: 4px;
    overflow-wrap: break-word;
  }
  .timer { margin-bottom: 16px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .btn-row { display: flex; }
  .btn {
    display: inline-block;
    min-height: 40px;
    padding: 8px 16px;
    border-radius: 8px;
    font-weight: 600;
    text-decoration: none;
    transition: opacity 0.15s;
  }
  a.btn:hover { opacity: 0.9; }
  .btn.full { display: block; width: 100%; }
  .close {
    position: absolute;
    top: -12px;
    width: 28px;
    height: 28px;
    padding: 0;
    border: none;
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.95);
    color: #333;
    font: 18px/1 sans-serif;
    cursor: pointer;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
  }
  .bottom-right .close, .top-right .close { left: -12px; }
  .bottom-left .close, .top-left .close { right: -12px; }
</style>
