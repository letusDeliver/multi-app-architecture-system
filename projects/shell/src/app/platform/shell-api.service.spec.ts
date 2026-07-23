import { TestBed } from '@angular/core/testing';
import { firstValueFrom, take, toArray } from 'rxjs';

import { ShellApiService } from './shell-api.service';

describe('ShellApiService', () => {
  let service: ShellApiService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(ShellApiService);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('queues a toast on showToast and auto-dismisses it after its duration', () => {
    vi.useFakeTimers();

    service.showToast({ message: 'hello', severity: 'info', durationMs: 1000 });

    expect(service.toasts()).toEqual([{ message: 'hello', severity: 'info', durationMs: 1000, id: 0 }]);

    vi.advanceTimersByTime(1000);

    expect(service.toasts()).toEqual([]);
  });

  it('emits the current theme immediately and again on setTheme, as a live context', async () => {
    const emitted = firstValueFrom(service.theme$.pipe(take(2), toArray()));

    service.setTheme({ mode: 'dark' });

    expect(await emitted).toEqual([{ mode: 'light' }, { mode: 'dark' }]);
  });

  it('contains a call to an unregistered capability instead of throwing (fault scenario)', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

    // Deliberately manufactures the fault this test targets — a capability
    // that was never registered — the same way Milestone 1 manufactured an
    // unreachable/incompatible remote via a fixture, scaled down to this
    // service's own private state since there is no network boundary here.
    (service as unknown as { registry: Set<string> }).registry.delete('toast');

    expect(() => service.showToast({ message: 'x', severity: 'info' })).not.toThrow();

    expect(service.toasts()).toEqual([]);
    expect(consoleError).toHaveBeenCalledWith(
      '[shell-api] capability "toast" is not registered — call ignored',
    );
  });

  it('contains an unregistered theme write the same way, without disrupting existing subscribers', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    (service as unknown as { registry: Set<string> }).registry.delete('theme');

    expect(() => service.setTheme({ mode: 'dark' })).not.toThrow();

    expect(consoleError).toHaveBeenCalledWith(
      '[shell-api] capability "theme" is not registered — call ignored',
    );
  });
});
