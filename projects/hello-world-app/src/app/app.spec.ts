import { TestBed } from '@angular/core/testing';
import { SHELL_API, ShellPublicApi, ToastRequest } from '@platform/shell-api-contracts';
import { Subject } from 'rxjs';

import { Component as AppRoot } from './app';

describe('AppRoot (exposed as "./Component")', () => {
  let showToast: ReturnType<typeof vi.fn<(request: ToastRequest) => void>>;
  let theme$: Subject<{ mode: 'light' | 'dark' }>;

  beforeEach(async () => {
    showToast = vi.fn();
    theme$ = new Subject();

    const shellApiStub: ShellPublicApi = { showToast, theme$ };

    await TestBed.configureTestingModule({
      imports: [AppRoot],
      providers: [{ provide: SHELL_API, useValue: shellApiStub }],
    }).compileComponents();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(AppRoot);
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('should render its mount marker content', () => {
    const fixture = TestBed.createComponent(AppRoot);
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain('Hello from hello-world-app');
  });

  it('calls SHELL_API.showToast — never rendering its own toast UI — when notifying the shell', () => {
    const fixture = TestBed.createComponent(AppRoot);
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;

    compiled.querySelector('button')?.dispatchEvent(new Event('click'));

    expect(showToast).toHaveBeenCalledWith({
      message: 'Hello from hello-world-app',
      severity: 'info',
    });
  });

  it('renders the shell-owned theme reactively, as a pure consumer of theme$', () => {
    const fixture = TestBed.createComponent(AppRoot);
    fixture.detectChanges();

    theme$.next({ mode: 'dark' });
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain('Shell theme: dark');
  });
});
