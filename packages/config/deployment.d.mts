export type BrandSettings = {displayName?: string; description?: string; tagline?: string; accentColor?: string; accentContrastColor?: string};
export function cmsTarget(projectId?: string, dataset?: string, apiVersion?: string): {projectId: string; dataset: string; apiVersion: string; origin: string; assetPrefix: string};
export function deploymentKind(value?: string): 'demo' | 'client';
export function publicUrl(value: string | undefined, label: string): string;
export function brandConfig(kind: string, settings?: BrandSettings): {name: string; description: string; tagline: string; accentColor?: string; accentContrastColor?: string};
