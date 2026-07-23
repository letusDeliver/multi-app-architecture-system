import { TestBed } from '@angular/core/testing';

import { ShellApiService } from './shell-api.service';
import { ToastHostComponent } from './toast-host.component';

describe('ToastHostComponent', () => {
  it('renders zero toasts when none have been requested', () => {
    TestBed.configureTestingModule({ imports: [ToastHostComponent] });
    const fixture = TestBed.createComponent(ToastHostComponent);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelectorAll('li')).toHaveLength(0);
  });

  it('renders a toast requested through ShellApiService — the only entry point, never its own UI', () => {
    TestBed.configureTestingModule({ imports: [ToastHostComponent] });
    const fixture = TestBed.createComponent(ToastHostComponent);
    const shellApi = TestBed.inject(ShellApiService);

    shellApi.showToast({ message: 'Saved successfully', severity: 'success' });
    fixture.detectChanges();

    const item = fixture.nativeElement.querySelector('li') as HTMLElement;
    expect(item.textContent).toContain('Saved successfully');
    expect(item.getAttribute('data-severity')).toBe('success');
  });
});
