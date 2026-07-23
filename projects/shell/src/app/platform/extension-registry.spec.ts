import { ExtensionRegistry } from './extension-registry';

interface FakeContribution {
  readonly id: string;
  readonly label: string;
}

describe('ExtensionRegistry', () => {
  let registry: ExtensionRegistry<FakeContribution>;

  beforeEach(() => {
    registry = new ExtensionRegistry<FakeContribution>();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('registers a contribution, attributing it to its owner', () => {
    registry.register('app-a', { id: 'one', label: 'One' });

    expect(registry.entries()).toEqual([{ ownerAppId: 'app-a', contribution: { id: 'one', label: 'One' } }]);
  });

  it('contains a duplicate id from a different owner instead of silently overwriting (fault scenario)', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

    registry.register('app-a', { id: 'one', label: 'First' });
    registry.register('app-b', { id: 'one', label: 'Second' });

    expect(registry.entries()).toEqual([{ ownerAppId: 'app-a', contribution: { id: 'one', label: 'First' } }]);
    expect(consoleError).toHaveBeenCalledWith(
      '[extension-registry] contribution id "one" is already registered — registration ignored',
    );
  });

  it('removes only the disposed entry via its own disposer', () => {
    const disposeOne = registry.register('app-a', { id: 'one', label: 'One' });
    registry.register('app-a', { id: 'two', label: 'Two' });

    disposeOne();

    expect(registry.entries()).toEqual([{ ownerAppId: 'app-a', contribution: { id: 'two', label: 'Two' } }]);
  });

  it('is safe and idempotent when a disposer is called more than once', () => {
    const dispose = registry.register('app-a', { id: 'one', label: 'One' });

    expect(() => {
      dispose();
      dispose();
    }).not.toThrow();
    expect(registry.entries()).toEqual([]);
  });

  it('is safe when a disposer is called after its owner was already bulk-deregistered (unload-then-dispose)', () => {
    const dispose = registry.register('app-a', { id: 'one', label: 'One' });

    registry.deregisterAll('app-a');
    expect(() => dispose()).not.toThrow();
    expect(registry.entries()).toEqual([]);
  });

  it('deregisterAll removes only the named owner\'s contributions, leaving other owners untouched', () => {
    registry.register('app-a', { id: 'one', label: 'One' });
    registry.register('app-b', { id: 'two', label: 'Two' });

    registry.deregisterAll('app-a');

    expect(registry.entries()).toEqual([{ ownerAppId: 'app-b', contribution: { id: 'two', label: 'Two' } }]);
  });

  it('stays internally consistent across repeated register → unregister → register → unload → register cycles', () => {
    const disposeFirst = registry.register('app-a', { id: 'one', label: 'First' });
    disposeFirst();

    registry.register('app-a', { id: 'one', label: 'Second' });
    registry.deregisterAll('app-a');

    registry.register('app-a', { id: 'one', label: 'Third' });

    expect(registry.entries()).toEqual([{ ownerAppId: 'app-a', contribution: { id: 'one', label: 'Third' } }]);
  });
});
