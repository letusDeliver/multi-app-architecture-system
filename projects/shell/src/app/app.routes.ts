import { Routes } from '@angular/router';

import { RemoteMountComponent } from './platform/remote-mount.component';

export const routes: Routes = [{ path: ':mountPath', component: RemoteMountComponent }];
