import { AsyncPipe } from '@angular/common';
import { Component, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { Disposer, SHELL_API } from '@platform/shell-api-contracts';

/**
 * This is the component exposed as './Component' (federation.config.js) —
 * the mount contract the shell's RemoteMountComponent loads dynamically at
 * runtime. It deliberately stays trivial: Milestone 1 exists to validate the
 * shell/application composition mechanism, not to build a real application.
 *
 * The mount contract is: the exposed module's named export literally called
 * `Component` is the thing the shell instantiates. Exposing a module path
 * named './Component' is not enough on its own — the shell has no way to
 * know which export inside that module is the mountable one unless the
 * export name itself is part of the contract.
 *
 * Milestone 2 added the Shell Public API v0 consumption: this component
 * injects SHELL_API — never a shell implementation class — to prove both
 * base communication patterns end to end: showToast() is application → shell
 * (Service API), theme$ is shell → application (live context as Observable).
 * Milestone 3 adds openDialog() — application → shell request/response —
 * completing the three communication shapes from ARCH-2026-03 §3/§4.
 * Milestone 4 adds registerHeaderAction() — this component never renders
 * the action itself, only registers a plain-data contribution; the shell's
 * HeaderActionsHostComponent owns rendering it in the header, and owns
 * removing it automatically the moment this application is unmounted.
 */
@Component({
  selector: 'app-root',
  imports: [AsyncPipe],
  template: `
    <p>Hello from hello-world-app — mounted by the shell via Native Federation.</p>
    @if (shellApi.theme$ | async; as theme) {
      <p>Shell theme: {{ theme.mode }}</p>
    }
    <button type="button" (click)="notifyShell()">Notify via shell</button>
    <button type="button" (click)="confirmViaShell()">Ask shell to confirm</button>
    @if (lastDialogResult(); as result) {
      <p>Shell dialog resolved with: {{ result }}</p>
    }
    <p>Header action registered: {{ headerActionRegistered() ? 'yes' : 'no' }}</p>
    <button type="button" (click)="unregisterHeaderAction()" [disabled]="!headerActionRegistered()">
      Unregister header action
    </button>
    <button type="button" (click)="registerHeaderAction()" [disabled]="headerActionRegistered()">
      Register header action again
    </button>
  `,
})
class AppRoot implements OnInit, OnDestroy {
  protected readonly shellApi = inject(SHELL_API);
  protected readonly lastDialogResult = signal<string | undefined>(undefined);
  protected readonly headerActionRegistered = signal(false);

  private disposeHeaderAction: Disposer | null = null;

  ngOnInit(): void {
    this.registerHeaderAction();
  }

  ngOnDestroy(): void {
    // Not required for correctness — the shell auto-deregisters every
    // contribution this application owns at Unmount regardless — but
    // calling the disposer here too proves it stays safe even when the
    // manual and automatic teardown paths both fire for the same entry.
    this.disposeHeaderAction?.();
  }

  protected notifyShell(): void {
    this.shellApi.showToast({ message: 'Hello from hello-world-app', severity: 'info' });
  }

  protected registerHeaderAction(): void {
    this.disposeHeaderAction = this.shellApi.registerHeaderAction({
      id: 'hello-world.greet',
      label: 'Say hello',
      onInvoke: () => this.shellApi.showToast({ message: 'Hello from the header!', severity: 'info' }),
    });
    this.headerActionRegistered.set(true);
  }

  protected unregisterHeaderAction(): void {
    this.disposeHeaderAction?.();
    this.disposeHeaderAction = null;
    this.headerActionRegistered.set(false);
  }

  protected async confirmViaShell(): Promise<void> {
    const result = await this.shellApi.openDialog<'delete' | 'cancel'>({
      title: 'Confirm action',
      message: "Requested by hello-world-app — the shell owns this dialog's chrome entirely.",
      actions: [
        { label: 'Cancel', value: 'cancel' },
        { label: 'Delete', value: 'delete', variant: 'primary' },
      ],
    });
    this.lastDialogResult.set(result ?? 'dismissed');
  }
}

export { AppRoot as Component };
