import { TestBed } from '@angular/core/testing';

import { HeaderActionsHostComponent } from './header-actions-host.component';
import { ShellApiService } from './shell-api.service';

describe('HeaderActionsHostComponent', () => {
  let service: ShellApiService;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [HeaderActionsHostComponent] });
    service = TestBed.inject(ShellApiService);
  });

  it('renders nothing when no header action is registered', () => {
    const fixture = TestBed.createComponent(HeaderActionsHostComponent);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelectorAll('button')).toHaveLength(0);
  });

  it('renders a registered header action\'s label and invokes its handler on click', () => {
    const onInvoke = vi.fn();
    service.registerHeaderAction({ id: 'a.one', label: 'Say hello', onInvoke }, 'app-a');

    const fixture = TestBed.createComponent(HeaderActionsHostComponent);
    fixture.detectChanges();

    const button: HTMLButtonElement = fixture.nativeElement.querySelector('button');
    expect(button.textContent?.trim()).toBe('Say hello');

    button.click();
    expect(onInvoke).toHaveBeenCalledTimes(1);
  });

  it('sorts rendered actions by ascending priority', () => {
    service.registerHeaderAction({ id: 'a.two', label: 'Second', priority: 10, onInvoke: () => {} }, 'app-a');
    service.registerHeaderAction({ id: 'a.one', label: 'First', priority: 0, onInvoke: () => {} }, 'app-a');

    const fixture = TestBed.createComponent(HeaderActionsHostComponent);
    fixture.detectChanges();

    const labels = Array.from(fixture.nativeElement.querySelectorAll('button')).map(
      (button) => (button as HTMLButtonElement).textContent?.trim(),
    );
    expect(labels).toEqual(['First', 'Second']);
  });

  it('reactively picks up a header action registered after the initial render (late registration)', () => {
    const fixture = TestBed.createComponent(HeaderActionsHostComponent);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelectorAll('button')).toHaveLength(0);

    service.registerHeaderAction({ id: 'a.late', label: 'Late', onInvoke: () => {} }, 'app-a');
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelectorAll('button')).toHaveLength(1);
  });

  it('removes a rendered action once its owning application is bulk-deregistered', () => {
    service.registerHeaderAction({ id: 'a.one', label: 'Say hello', onInvoke: () => {} }, 'app-a');

    const fixture = TestBed.createComponent(HeaderActionsHostComponent);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelectorAll('button')).toHaveLength(1);

    service.deregisterAllContributions('app-a');
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelectorAll('button')).toHaveLength(0);
  });
});
