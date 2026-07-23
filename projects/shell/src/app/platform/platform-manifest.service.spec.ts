import { TestBed } from '@angular/core/testing';
import { SUPPORTED_CONTRACT_VERSION } from '@platform/manifest-schema';

import { PlatformManifestService } from './platform-manifest.service';

function mockFetch(body: unknown, ok = true, status = 200): void {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({ ok, status, json: () => Promise.resolve(body) }),
  );
}

describe('PlatformManifestService', () => {
  let service: PlatformManifestService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(PlatformManifestService);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('registers a well-formed, compatible entry', async () => {
    mockFetch({
      applications: [
        {
          id: 'a',
          remoteEntryUrl: 'http://localhost:4201/remoteEntry.json',
          mountPath: 'a',
          navLabel: 'A',
          requiredEntitlement: null,
          contractVersion: SUPPORTED_CONTRACT_VERSION,
        },
      ],
    });

    await service.ensureDiscovered();

    expect(service.registeredApplications()).toHaveLength(1);
    expect(service.diagnostics()).toHaveLength(0);
    expect(service.discoveryComplete()).toBe(true);
  });

  it('rejects a malformed entry without affecting a well-formed one in the same manifest', async () => {
    mockFetch({
      applications: [
        { id: 'bad' },
        {
          id: 'good',
          remoteEntryUrl: 'http://localhost:4201/remoteEntry.json',
          mountPath: 'good',
          navLabel: 'Good',
          requiredEntitlement: null,
          contractVersion: SUPPORTED_CONTRACT_VERSION,
        },
      ],
    });

    await service.ensureDiscovered();

    expect(service.registeredApplications()).toHaveLength(1);
    expect(service.registeredApplications()[0].id).toBe('good');
    expect(service.diagnostics()).toHaveLength(1);
    expect(service.diagnostics()[0].id).toBe('bad');
  });

  it('rejects an entry with an incompatible contract version, never mounting it', async () => {
    mockFetch({
      applications: [
        {
          id: 'incompatible',
          remoteEntryUrl: 'http://localhost:4201/remoteEntry.json',
          mountPath: 'incompatible',
          navLabel: 'Incompatible',
          requiredEntitlement: null,
          contractVersion: '9.9.9',
        },
      ],
    });

    await service.ensureDiscovered();

    expect(service.registeredApplications()).toHaveLength(0);
    expect(service.diagnostics()[0]?.reason).toContain('incompatible contract version');
  });

  it('treats an unreachable manifest as zero registered applications, not a crash', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network down')));

    await expect(service.ensureDiscovered()).resolves.toBeUndefined();
    expect(service.registeredApplications()).toHaveLength(0);
    expect(service.discoveryComplete()).toBe(true);
  });

  it('treats a malformed manifest document (no applications array) as zero registered applications', async () => {
    mockFetch({ notAManifest: true });

    await service.ensureDiscovered();

    expect(service.registeredApplications()).toHaveLength(0);
    expect(service.discoveryComplete()).toBe(true);
  });
});
