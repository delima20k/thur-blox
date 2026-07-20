export const slugify = (value) => String(value || '')
  .normalize('NFKD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .trim()
  .replace(/\s+/g, '-')
  .replace(/[^a-z0-9-]+/g, '')
  .replace(/-+/g, '-')
  .replace(/^-+|-+$/g, '');
