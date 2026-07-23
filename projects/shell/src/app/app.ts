import { Component, OnInit, inject } from '@angular/core';
import { RouterLink, RouterOutlet } from '@angular/router';

import { PlatformManifestService } from './platform/platform-manifest.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App implements OnInit {
  protected readonly manifest = inject(PlatformManifestService);

  ngOnInit(): void {
    void this.manifest.ensureDiscovered();
  }
}
