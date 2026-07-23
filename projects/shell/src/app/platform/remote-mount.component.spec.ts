import { Component, inject } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { Disposer, SHELL_API } from '@platform/shell-api-contracts';

vi.mock('@angular-architects/native-federation', () => ({
  loadRemoteModule: vi.fn(),
}));

import { loadRemoteModule } from '@angular-architects/native-federation';
import { RemoteMountComponent } from './remote-mount.component';
import { PlatformManifestService, RegisteredApplication } from './platform-manifest.service';
import { ShellApiService } from './shell-api.service';

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

let capturedHeaderActionDisposer: Disposer | undefined;

/**
 * Registers a header action from inside the mounted application's own DI
 * context — the way a real remote application would, via `inject(SHELL_API)`
 * — to prove RemoteMountComponent's scoped wrapper attributes ownership
 * itself rather than trusting anything the application supplies.
 */
@Component({ selector: 'app-fake-remote-with-header-action', template: '' })
class FakeRemoteComponentWithHeaderAction {
  constructor() {
    const shellApi = inject(SHELL_API);
    capturedHeaderActionDisposer = shellApi.registerHeaderAction({
      id: 'remote.action',
      label: 'Remote Action',
      onInvoke: () => {},
    });
  }
}

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
    capturedHeaderActionDisposer = undefined;
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

  it('resolves any open dialog with undefined on Unmount, so it does not outlive the application', async () => {
    vi.mocked(loadRemoteModule).mockResolvedValue({ Component: FakeRemoteComponent });

    const fixture = setUp('hello-world', [HEALTHY_ENTRY]);
    await settle(fixture);

    const shellApi = TestBed.inject(ShellApiService);
    const pending = shellApi.openDialog({
      title: 'Confirm',
      message: 'Are you sure?',
      actions: [{ label: 'OK', value: 'ok' }],
      dismissible: false,
    });

    fixture.destroy();

    expect(await pending).toBeUndefined();
    expect(shellApi.dialog()).toBeNull();
  });

  it('attributes a header action registered by the mounted application to its own manifest entry id, never a self-declared one', async () => {
    vi.mocked(loadRemoteModule).mockResolvedValue({ Component: FakeRemoteComponentWithHeaderAction });

    const fixture = setUp('hello-world', [HEALTHY_ENTRY]);
    await settle(fixture);

    const shellApi = TestBed.inject(ShellApiService);
    expect(shellApi.headerActions()).toEqual([
      {
        ownerAppId: HEALTHY_ENTRY.id,
        contribution: expect.objectContaining({ id: 'remote.action', label: 'Remote Action' }),
      },
    ]);
  });

  it('automatically deregisters the mounted application\'s header actions on Unmount, so a contribution cannot survive application unload', async () => {
    vi.mocked(loadRemoteModule).mockResolvedValue({ Component: FakeRemoteComponentWithHeaderAction });

    const fixture = setUp('hello-world', [HEALTHY_ENTRY]);
    await settle(fixture);

    const shellApi = TestBed.inject(ShellApiService);
    expect(shellApi.headerActions()).toHaveLength(1);

    fixture.destroy();

    expect(shellApi.headerActions()).toEqual([]);
  });

  it('is safe to call a header action disposer obtained before Unmount, after Unmount has already occurred', async () => {
    vi.mocked(loadRemoteModule).mockResolvedValue({ Component: FakeRemoteComponentWithHeaderAction });

    const fixture = setUp('hello-world', [HEALTHY_ENTRY]);
    await settle(fixture);

    fixture.destroy();

    expect(() => capturedHeaderActionDisposer?.()).not.toThrow();

    const shellApi = TestBed.inject(ShellApiService);
    expect(shellApi.headerActions()).toEqual([]);
  });
});
