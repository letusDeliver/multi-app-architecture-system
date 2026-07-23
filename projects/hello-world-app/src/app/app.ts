import { AsyncPipe } from '@angular/common';
import { Component, inject } from '@angular/core';
import { SHELL_API } from '@platform/shell-api-contracts';

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
 * Milestone 2 adds the Shell Public API v0 consumption: this component
 * injects SHELL_API — never a shell implementation class — to prove both
 * base communication patterns end to end: showToast() is application → shell
 * (Service API), theme$ is shell → application (live context as Observable).
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
  `,
})
class AppRoot {
  protected readonly shellApi = inject(SHELL_API);

  protected notifyShell(): void {
    this.shellApi.showToast({ message: 'Hello from hello-world-app', severity: 'info' });
  }
}

export { AppRoot as Component };
