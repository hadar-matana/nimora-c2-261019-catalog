// Public deployment identity only. Never pass credentials to this module.
export function cmsTarget(projectId, dataset, apiVersion) {
  if (typeof projectId !== 'string' || !/^[a-z0-9]{1,32}$/.test(projectId)) throw new Error('Invalid or missing Sanity project ID');
  if (typeof dataset !== 'string' || !/^[a-z0-9][a-z0-9_-]{0,63}$/.test(dataset)) throw new Error('Invalid or missing Sanity dataset');
  if (typeof apiVersion !== 'string' || !/^20\d{2}-\d{2}-\d{2}$/.test(apiVersion) || !Number.isFinite(Date.parse(apiVersion)) || new Date(apiVersion).toISOString().slice(0,10) !== apiVersion) throw new Error('Invalid or missing Sanity API version');
  return {projectId, dataset, apiVersion, origin: `https://${projectId}.api.sanity.io`, assetPrefix: `https://cdn.sanity.io/images/${projectId}/${dataset}/`};
}
export function deploymentKind(value) {
  if (!['demo', 'client'].includes(value)) throw new Error('Deployment kind must explicitly be demo or client');
  return value;
}
export function publicUrl(value, label) {
  let url;
  try { url = new URL(value); } catch { throw new Error(`Invalid or missing ${label}`); }
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || (url.protocol !== 'https:' && !['localhost','127.0.0.1','[::1]'].includes(url.hostname))) throw new Error(`Invalid ${label}`);
  return url.href.replace(/\/$/, '');
}
export function brandConfig(kind, settings = {}) {
  deploymentKind(kind);
  // The approved demo intentionally overrides legacy CMS branding.
  if (kind === 'demo') return {name: 'ATELIER', description: 'גלו את הקולקציה ואת הפריטים שלנו.', tagline: 'אופנה נשית. בכל יום מחדש.', accentColor: undefined, accentContrastColor: undefined};
  const name = settings.displayName?.trim();
  const description = settings.description?.trim();
  if (!name || !description) throw new Error('Client brand name and description are required');
  for (const color of [settings.accentColor, settings.accentContrastColor]) {
    if (color && !/^#[0-9a-fA-F]{6}$/.test(color)) throw new Error('Brand colors must be six-digit HEX values');
  }
  return {name, description, tagline: settings.tagline?.trim() || '', accentColor: settings.accentColor, accentContrastColor: settings.accentContrastColor};
}
