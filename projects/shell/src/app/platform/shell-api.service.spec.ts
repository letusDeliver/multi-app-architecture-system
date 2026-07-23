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

  it('resolves openDialog with the chosen action value on resolveDialog', async () => {
    const pending = service.openDialog<'delete' | 'cancel'>({
      title: 'Confirm',
      message: 'Are you sure?',
      actions: [
        { label: 'Cancel', value: 'cancel' },
        { label: 'Delete', value: 'delete', variant: 'primary' },
      ],
    });

    expect(service.dialog()?.request.title).toBe('Confirm');

    service.resolveDialog('delete');

    expect(await pending).toBe('delete');
    expect(service.dialog()).toBeNull();
  });

  it('resolves openDialog with undefined on dismissDialog when dismissible', async () => {
    const pending = service.openDialog({
      title: 'Confirm',
      message: 'Are you sure?',
      actions: [{ label: 'OK', value: 'ok' }],
    });

    service.dismissDialog();

    expect(await pending).toBeUndefined();
    expect(service.dialog()).toBeNull();
  });

  it('ignores dismissDialog when the open dialog is marked non-dismissible', async () => {
    const pending = service.openDialog({
      title: 'Confirm',
      message: 'Are you sure?',
      actions: [{ label: 'OK', value: 'ok' }],
      dismissible: false,
    });

    service.dismissDialog();
    expect(service.dialog()).not.toBeNull();

    service.resolveDialog('ok');
    expect(await pending).toBe('ok');
  });

  it('resolves an open dialog with undefined on cancelDialog, regardless of dismissible', async () => {
    const pending = service.openDialog({
      title: 'Confirm',
      message: 'Are you sure?',
      actions: [{ label: 'OK', value: 'ok' }],
      dismissible: false,
    });

    service.cancelDialog();

    expect(await pending).toBeUndefined();
    expect(service.dialog()).toBeNull();
  });

  it('contains a call to openDialog on an unregistered capability instead of throwing (fault scenario)', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    (service as unknown as { registry: Set<string> }).registry.delete('dialog');

    const result = await service.openDialog({
      title: 'Confirm',
      message: 'Are you sure?',
      actions: [{ label: 'OK', value: 'ok' }],
    });

    expect(result).toBeUndefined();
    expect(service.dialog()).toBeNull();
    expect(consoleError).toHaveBeenCalledWith(
      '[shell-api] capability "dialog" is not registered — call ignored',
    );
  });
});
