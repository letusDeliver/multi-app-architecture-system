import { TestBed } from '@angular/core/testing';
import { SHELL_API, ShellPublicApi, ToastRequest } from '@platform/shell-api-contracts';
import { Subject } from 'rxjs';

import { Component as AppRoot } from './app';

describe('AppRoot (exposed as "./Component")', () => {
  let showToast: ReturnType<typeof vi.fn<(request: ToastRequest) => void>>;
  let openDialog: ReturnType<typeof vi.fn<(request: unknown) => Promise<unknown>>>;
  let theme$: Subject<{ mode: 'light' | 'dark' }>;

  beforeEach(async () => {
    showToast = vi.fn();
    openDialog = vi.fn().mockResolvedValue('delete');
    theme$ = new Subject();

    const shellApiStub: ShellPublicApi = {
      showToast,
      theme$,
      openDialog: openDialog as unknown as ShellPublicApi['openDialog'],
    };

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

  it('calls SHELL_API.openDialog — never rendering its own modal UI — and displays the resolved value', async () => {
    const fixture = TestBed.createComponent(AppRoot);
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;

    const buttons = compiled.querySelectorAll('button');
    buttons[1].dispatchEvent(new Event('click'));
    await fixture.whenStable();
    fixture.detectChanges();

    expect(openDialog).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Confirm action' }),
    );
    expect(compiled.textContent).toContain('Shell dialog resolved with: delete');
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
