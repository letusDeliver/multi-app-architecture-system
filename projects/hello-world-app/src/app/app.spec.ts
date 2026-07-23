import { TestBed } from '@angular/core/testing';
import {
  Disposer,
  HeaderActionContribution,
  SHELL_API,
  ShellPublicApi,
  ToastRequest,
} from '@platform/shell-api-contracts';
import { Subject } from 'rxjs';

import { Component as AppRoot } from './app';

describe('AppRoot (exposed as "./Component")', () => {
  let showToast: ReturnType<typeof vi.fn<(request: ToastRequest) => void>>;
  let openDialog: ReturnType<typeof vi.fn<(request: unknown) => Promise<unknown>>>;
  let registerHeaderAction: ReturnType<typeof vi.fn<(contribution: HeaderActionContribution) => Disposer>>;
  let theme$: Subject<{ mode: 'light' | 'dark' }>;

  beforeEach(async () => {
    showToast = vi.fn();
    openDialog = vi.fn().mockResolvedValue('delete');
    registerHeaderAction = vi.fn().mockReturnValue(vi.fn());
    theme$ = new Subject();

    const shellApiStub: ShellPublicApi = {
      showToast,
      theme$,
      openDialog: openDialog as unknown as ShellPublicApi['openDialog'],
      registerHeaderAction,
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

  it('registers a header action on init — a plain-data contribution, never its own rendered UI', () => {
    const fixture = TestBed.createComponent(AppRoot);
    fixture.detectChanges();

    expect(registerHeaderAction).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'hello-world.greet', label: 'Say hello' }),
    );
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain('Header action registered: yes');
  });

  it('disposes and can re-register the header action via the returned disposer', () => {
    const dispose = vi.fn();
    registerHeaderAction.mockReturnValue(dispose);

    const fixture = TestBed.createComponent(AppRoot);
    fixture.detectChanges();

    const [, , unregisterButton] = fixture.nativeElement.querySelectorAll('button');
    unregisterButton.dispatchEvent(new Event('click'));
    fixture.detectChanges();

    expect(dispose).toHaveBeenCalledTimes(1);
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Header action registered: no');

    const [, , , registerButton] = fixture.nativeElement.querySelectorAll('button');
    registerButton.dispatchEvent(new Event('click'));
    fixture.detectChanges();

    expect(registerHeaderAction).toHaveBeenCalledTimes(2);
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Header action registered: yes');
  });
});
