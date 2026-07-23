import { Component } from '@angular/core';

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
 */
@Component({
  selector: 'app-root',
  template: `<p>Hello from hello-world-app — mounted by the shell via Native Federation.</p>`,
})
class AppRoot {}

export { AppRoot as Component };
