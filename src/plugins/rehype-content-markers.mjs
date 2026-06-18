/**
 * rehype plugin:
 * - transforms <!-- marker: TYPE --> + <blockquote> pairs into styled marker blocks
 * - wraps tables so all article tables get the shared responsive table styling
 *
 * Supported types: experience, verified, varies, opinion
 */

const MARKER_REGEX = /^\s*marker:\s*(experience|verified|varies|opinion)\s*$/;

const MARKER_LABELS = {
  experience: '体験談',
  verified: '検証済み',
  varies: '条件次第',
  opinion: '個人の意見',
};

/** @type {import('unified').Plugin} */
export default function rehypeContentMarkers() {
  return (tree) => {
    wrapTables(tree);

    const { children } = tree;
    const toRemove = [];

    for (let i = 0; i < children.length; i++) {
      const node = children[i];

      // Look for HTML comment nodes: { type: 'raw', value: '<!-- marker: TYPE -->' }
      // or comment nodes in rehype: { type: 'comment', value: '...' }
      let markerType = null;

      if (node.type === 'raw' && typeof node.value === 'string') {
        const match = node.value.replace(/^<!--/, '').replace(/-->$/, '').match(MARKER_REGEX);
        if (match) markerType = match[1];
      } else if (node.type === 'comment' && typeof node.value === 'string') {
        const match = node.value.match(MARKER_REGEX);
        if (match) markerType = match[1];
      }

      if (!markerType) continue;

      // Find the next non-text sibling (skip whitespace text nodes)
      let nextIdx = i + 1;
      while (nextIdx < children.length) {
        const next = children[nextIdx];
        if (next.type === 'text' && /^\s*$/.test(next.value)) {
          nextIdx++;
          continue;
        }
        break;
      }

      if (nextIdx < children.length) {
        const blockquote = children[nextIdx];
        if (blockquote.tagName === 'blockquote') {
          // Add marker attributes and class
          blockquote.properties = blockquote.properties || {};
          blockquote.properties['dataMarker'] = markerType;
          blockquote.properties.className = [
            ...(blockquote.properties.className || []),
            'content-marker',
            `marker-${markerType}`,
          ];

          // Append label as a trailing tag. Do not put labels at the start of
          // the sentence/block; article rules require marker labels to be
          // shown at the end or as supporting metadata.
          blockquote.children.push({
            type: 'element',
            tagName: 'span',
            properties: {
              className: ['marker-label'],
              'aria-label': `情報種別：${MARKER_LABELS[markerType]}`,
            },
            children: [{ type: 'text', value: `［${MARKER_LABELS[markerType]}］` }],
          });

          // Mark comment node for removal
          toRemove.push(i);
        }
      }
    }

    // Remove comment nodes (reverse order to preserve indices)
    for (let idx = toRemove.length - 1; idx >= 0; idx--) {
      children.splice(toRemove[idx], 1);
    }
  };
}

function wrapTables(node) {
  if (!node || !Array.isArray(node.children)) return;

  for (let i = 0; i < node.children.length; i++) {
    const child = node.children[i];

    if (child?.tagName === 'table') {
      node.children[i] = {
        type: 'element',
        tagName: 'div',
        properties: { className: ['table-wrapper'] },
        children: [child],
      };
      continue;
    }

    // Do not double-wrap tables already inside the shared wrapper.
    const className = child?.properties?.className || [];
    if (Array.isArray(className) && className.includes('table-wrapper')) {
      continue;
    }

    wrapTables(child);
  }
}
