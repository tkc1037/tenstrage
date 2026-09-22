// Keep ASP-issued hrefs intact while identifying paid editorial links.
export default function rehypeAffiliateLinks() {
  return (tree) => {
    function visit(node) {
      if (node.tagName === 'a' && typeof node.properties?.href === 'string' && node.properties.href.startsWith('https://px.a8.net/')) {
        const existing = node.properties.rel || [];
        const tokens = Array.isArray(existing) ? existing : String(existing).split(/\s+/);
        node.properties.rel = [...new Set([...tokens, 'sponsored', 'nofollow'])];
        node.properties.dataAffiliatePlacement = 'article-inline';
      }
      for (const child of node.children || []) visit(child);
    }
    visit(tree);
  };
}
