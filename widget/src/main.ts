import './Widget.svelte'; // registers <campaign-widget>

/**
 * The embed: <script src=".../campaign.js" data-config="..." async></script>.
 *
 * Puts one <campaign-widget> at the top of <body> (first, so the Broadcasts bar
 * sits above the page in normal flow; the card and video are position:fixed and
 * don't care) and points it at the config: data-config, else
 * campaign-config.json next to this script. A widget already on the page is
 * left alone — the admin preview places its own and sets `.config` instead.
 */
try {
  const script =
    (document.currentScript as HTMLScriptElement | null) ??
    document.querySelector<HTMLScriptElement>('script[src*="campaign.js"]');
  const configUrl = script?.dataset.config || new URL('campaign-config.json', script?.src || location.href).href;
  const mount = () => {
    if (document.querySelector('campaign-widget')) return;
    const el = document.createElement('campaign-widget');
    el.setAttribute('src', configUrl);
    document.body.prepend(el);
  };
  if (document.body) mount();
  else document.addEventListener('DOMContentLoaded', mount);
} catch (e) {
  console.warn('[campaign-widget]', e);
}
