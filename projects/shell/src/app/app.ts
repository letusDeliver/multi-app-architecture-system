import { AsyncPipe } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { RouterLink, RouterOutlet } from '@angular/router';

import { DialogHostComponent } from './platform/dialog-host.component';
import { HeaderActionsHostComponent } from './platform/header-actions-host.component';
import { PlatformManifestService } from './platform/platform-manifest.service';
import { ShellApiService } from './platform/shell-api.service';
import { ToastHostComponent } from './platform/toast-host.component';

@Component({
  selector: 'app-root',
  imports: [
    RouterOutlet,
    RouterLink,
    AsyncPipe,
    ToastHostComponent,
    DialogHostComponent,
    HeaderActionsHostComponent,
  ],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App implements OnInit {
  protected readonly manifest = inject(PlatformManifestService);
  protected readonly shellApi = inject(ShellApiService);

  ngOnInit(): void {
    void this.manifest.ensureDiscovered();
  }

  protected toggleTheme(currentMode: 'light' | 'dark'): void {
    this.shellApi.setTheme({ mode: currentMode === 'light' ? 'dark' : 'light' });
  }
}
