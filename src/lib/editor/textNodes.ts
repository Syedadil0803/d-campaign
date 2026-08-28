/**
 * Every text node under an element that actually says something.
 *
 * Two details it carries that a re-implementation tends to lose. Zero-width
 * spaces are stripped before the emptiness check — the editors insert them to
 * give the caret somewhere to sit, and a node holding only one is not text the
 * user wrote. And whitespace-only nodes are dropped, so the indentation
 * between two elements does not count as content.
 *
 * It existed three times, character for character, in the two rich-text hooks
 * and the format reader. Three copies of a rule is how one of them quietly
 * stops matching the others.
 */
export function collectTextNodes(root: Node): Node[] {
  const found: Node[] = [];
  const walk = (node: Node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent?.replace(/\u200B/g, '').trim();
      if (text) found.push(node);
      return;
    }
    node.childNodes.forEach(walk);
  };
  walk(root);
  return found;
}
