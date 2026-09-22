/** Fold common Japanese search variants without storing or sending queries. */
export function normalizeSearch(value) {
  return value.normalize('NFKC').toLowerCase()
    .replace(/[ァ-ヶ]/g, (character) => String.fromCharCode(character.charCodeAt(0) - 0x60))
    .replace(/[\s\u3000]+/g, ' ').trim();
}

export function matchesQuestion(searchText, query, itemCategory, category = '') {
  if (category && itemCategory !== category) return false;
  const haystack = normalizeSearch(searchText);
  return normalizeSearch(query).split(' ').filter(Boolean).every((term) => haystack.includes(term));
}
