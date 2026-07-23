import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap } from '@angular/router';

vi.mock('@angular-architects/native-federation', () => ({
  loadRemoteModule: vi.fn(),
}));

import { loadRemoteModule } from '@angular-architects/native-federation';
import { RemoteMountComponent } from './remote-mount.component';
import { PlatformManifestService, RegisteredApplication } from './platform-manifest.service';

const HEALTHY_ENTRY: RegisteredApplication = {
  id: 'hello-world-app',
  remoteEntryUrl: 'http://localhost:4201/remoteEntry.json',
  mountPath: 'hello-world',
  navLabel: 'Hello World',
  requiredEntitlement: null,
  contractVersion: '0.1.0',
};

@Component({ selector: 'app-fake-remote', template: 'fake remote content' })
class FakeRemoteComponent {}

function setUp(mountPath: string, registered: readonly RegisteredApplication[]) {
  const manifestStub = {
    ensureDiscovered: () => Promise.resolve(),
    findByMountPath: (path: string) => registered.find((app) => app.mountPath === path),
  };

  TestBed.configureTestingModule({
    imports: [RemoteMountComponent],
    providers: [
      { provide: PlatformManifestService, useValue: manifestStub },
      {
        provide: ActivatedRoute,
        useValue: { snapshot: { paramMap: convertToParamMap({ mountPath }) } },
      },
    ],
  });

  return TestBed.createComponent(RemoteMountComponent);
}

/** Flushes the chained `await ensureDiscovered()` → `await loadRemoteModule()` microtask sequence. */
async function settle(fixture: ReturnType<typeof setUp>): Promise<void> {
  fixture.detectChanges();
  for (let i = 0; i < 3; i++) {
    await fixture.whenStable();
    fixture.detectChanges();
  }
}

describe('RemoteMountComponent', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders a contained "not registered" state for a path with no matching manifest entry', async () => {
    const fixture = setUp('does-not-exist', []);
    await settle(fixture);

    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('No application is registered');
  });

  it('mounts the remote component when loadRemoteModule resolves with a conforming export', async () => {
    vi.mocked(loadRemoteModule).mockResolvedValue({ Component: FakeRemoteComponent });

    const fixture = setUp('hello-world', [HEALTHY_ENTRY]);
    await settle(fixture);

    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('fake remote content');
  });

  it('renders a contained "unavailable" state when the remote is unreachable, without throwing', async () => {
    vi.mocked(loadRemoteModule).mockRejectedValue(new Error('fetch failed'));

    const fixture = setUp('hello-world', [HEALTHY_ENTRY]);
    await settle(fixture);

    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('currently unavailable');
  });

  it('renders a contained "unavailable" state when the remote loads but does not expose a Component', async () => {
    vi.mocked(loadRemoteModule).mockResolvedValue({ somethingElse: {} });

    const fixture = setUp('hello-world', [HEALTHY_ENTRY]);
    await settle(fixture);

    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('currently unavailable');
  });
});
