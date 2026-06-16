// Reversible V1 gating. Flip a value to true to re-enable that tab everywhere.
export const FEATURE_FLAGS = { promote: false, studio: false, leads: false } as const
export type FeatureKey = keyof typeof FEATURE_FLAGS
export function isFeatureEnabled(k: FeatureKey): boolean {
  return FEATURE_FLAGS[k]
}
