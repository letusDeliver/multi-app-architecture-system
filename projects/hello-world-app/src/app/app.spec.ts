import { TestBed } from '@angular/core/testing';

import { Component as AppRoot } from './app';

describe('AppRoot (exposed as "./Component")', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AppRoot],
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
});
