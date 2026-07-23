import { TestBed } from '@angular/core/testing';

import { DialogHostComponent } from './dialog-host.component';
import { ShellApiService } from './shell-api.service';

describe('DialogHostComponent', () => {
  it('renders nothing when no dialog is open', () => {
    TestBed.configureTestingModule({ imports: [DialogHostComponent] });
    const fixture = TestBed.createComponent(DialogHostComponent);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.dialog-backdrop')).toBeNull();
  });

  it('renders the requested dialog through ShellApiService — the only entry point, never its own UI', () => {
    TestBed.configureTestingModule({ imports: [DialogHostComponent] });
    const fixture = TestBed.createComponent(DialogHostComponent);
    const shellApi = TestBed.inject(ShellApiService);

    void shellApi.openDialog({
      title: 'Confirm action',
      message: 'Are you sure?',
      actions: [
        { label: 'Cancel', value: 'cancel' },
        { label: 'Delete', value: 'delete', variant: 'primary' },
      ],
    });
    fixture.detectChanges();

    const panel = fixture.nativeElement.querySelector('.dialog-panel') as HTMLElement;
    expect(panel.querySelector('h2')?.textContent).toBe('Confirm action');
    expect(panel.querySelectorAll('button')).toHaveLength(2);
  });

  it('resolves the dialog with the clicked action value and closes', async () => {
    TestBed.configureTestingModule({ imports: [DialogHostComponent] });
    const fixture = TestBed.createComponent(DialogHostComponent);
    const shellApi = TestBed.inject(ShellApiService);

    const pending = shellApi.openDialog<'delete' | 'cancel'>({
      title: 'Confirm action',
      message: 'Are you sure?',
      actions: [
        { label: 'Cancel', value: 'cancel' },
        { label: 'Delete', value: 'delete', variant: 'primary' },
      ],
    });
    fixture.detectChanges();

    const buttons = fixture.nativeElement.querySelectorAll('button') as NodeListOf<HTMLButtonElement>;
    buttons[1].click();
    fixture.detectChanges();

    expect(await pending).toBe('delete');
    expect(fixture.nativeElement.querySelector('.dialog-backdrop')).toBeNull();
  });

  it('dismisses the dialog on backdrop click', async () => {
    TestBed.configureTestingModule({ imports: [DialogHostComponent] });
    const fixture = TestBed.createComponent(DialogHostComponent);
    const shellApi = TestBed.inject(ShellApiService);

    const pending = shellApi.openDialog({
      title: 'Confirm action',
      message: 'Are you sure?',
      actions: [{ label: 'OK', value: 'ok' }],
    });
    fixture.detectChanges();

    (fixture.nativeElement.querySelector('.dialog-backdrop') as HTMLElement).click();
    fixture.detectChanges();

    expect(await pending).toBeUndefined();
    expect(fixture.nativeElement.querySelector('.dialog-backdrop')).toBeNull();
  });

  it('does not dismiss on a click inside the panel itself', () => {
    TestBed.configureTestingModule({ imports: [DialogHostComponent] });
    const fixture = TestBed.createComponent(DialogHostComponent);
    const shellApi = TestBed.inject(ShellApiService);

    void shellApi.openDialog({
      title: 'Confirm action',
      message: 'Are you sure?',
      actions: [{ label: 'OK', value: 'ok' }],
    });
    fixture.detectChanges();

    (fixture.nativeElement.querySelector('.dialog-panel') as HTMLElement).click();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.dialog-backdrop')).not.toBeNull();
  });
});
