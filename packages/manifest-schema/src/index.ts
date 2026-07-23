/**
 * @platform/manifest-schema v0
 *
 * Minimal shape for a platform application manifest entry, per ARCH-2026-02 §6's
 * ratified minimum (id, remote entry reference, required entitlement, nav label,
 * mount path prefix) plus `contractVersion`, needed to exercise the capability
 * negotiation rule in ARCH-2026-03 §6 ("fail loudly at the boundary, never mount
 * into an undefined runtime state").
 *
 * Deliberately excludes fields not exercised by Milestone 1 (e.g. nav icon,
 * framework-version declaration) per the "evolve only when implementation
 * requires it" instruction for this milestone.
 */

/** The single contract version the shell currently supports. No bounded window yet (M1: one shell, one contract version) — that's Decision 003/006 territory, out of scope here. */
export const SUPPORTED_CONTRACT_VERSION = '0.1.0';

export interface ApplicationManifestEntry {
  readonly id: string;
  readonly remoteEntryUrl: string;
  readonly mountPath: string;
  readonly navLabel: string;
  readonly requiredEntitlement: string | null;
  readonly contractVersion: string;
}

export interface PlatformManifest {
  readonly applications: readonly ApplicationManifestEntry[];
}

export type ManifestValidationFailure =
  | { readonly kind: 'malformed'; readonly reason: string }
  | {
      readonly kind: 'incompatible-contract-version';
      readonly declared: string;
      readonly supported: string;
    };

export type ManifestValidationResult =
  | { readonly ok: true; readonly entry: ApplicationManifestEntry }
  | { readonly ok: false; readonly id: string | undefined; readonly failure: ManifestValidationFailure };

const REQUIRED_STRING_FIELDS = ['id', 'remoteEntryUrl', 'mountPath', 'navLabel', 'contractVersion'] as const;

/**
 * Registration-stage validation (ARCH-2026-03 §2): structural shape first,
 * then contract-version compatibility. Kept as two distinct failure kinds so
 * a malformed entry and an incompatible-but-well-formed entry produce
 * different, clear diagnostics rather than one generic rejection.
 */
export function validateManifestEntry(candidate: unknown): ManifestValidationResult {
  const id = isRecord(candidate) && typeof candidate['id'] === 'string' ? candidate['id'] : undefined;

  if (!isRecord(candidate)) {
    return { ok: false, id, failure: { kind: 'malformed', reason: 'entry is not an object' } };
  }

  for (const field of REQUIRED_STRING_FIELDS) {
    if (typeof candidate[field] !== 'string' || candidate[field] === '') {
      return {
        ok: false,
        id,
        failure: { kind: 'malformed', reason: `missing or empty required field "${field}"` },
      };
    }
  }

  if ('requiredEntitlement' in candidate) {
    const value = candidate['requiredEntitlement'];
    if (value !== null && typeof value !== 'string') {
      return {
        ok: false,
        id,
        failure: { kind: 'malformed', reason: '"requiredEntitlement" must be a string or null' },
      };
    }
  } else {
    return {
      ok: false,
      id,
      failure: { kind: 'malformed', reason: 'missing required field "requiredEntitlement"' },
    };
  }

  const entry = candidate as unknown as ApplicationManifestEntry;

  if (entry.contractVersion !== SUPPORTED_CONTRACT_VERSION) {
    return {
      ok: false,
      id,
      failure: {
        kind: 'incompatible-contract-version',
        declared: entry.contractVersion,
        supported: SUPPORTED_CONTRACT_VERSION,
      },
    };
  }

  return { ok: true, entry };
}

/** Discovery-stage validation (ARCH-2026-03 §2): is this even a well-formed manifest document at all. */
export function isPlatformManifest(candidate: unknown): candidate is PlatformManifest {
  return isRecord(candidate) && Array.isArray(candidate['applications']);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
