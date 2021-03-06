import { Breadcrumb, SentryBreadcrumbHint, SentryEvent, SentryEventHint, Severity } from '@sentry/types';
import { uuid4 } from '@sentry/utils/misc';
import { Layer } from './interfaces';
import { Scope } from './scope';

/**
 * API compatibility version of this hub.
 *
 * WARNING: This number should only be incresed when the global interface
 * changes a and new methods are introduced.
 */
export const API_VERSION = 3;

/**
 * Internal class used to make sure we always have the latest internal functions
 * working in case we have a version conflict.
 */
export class Hub {
  /** Is a {@link Layer}[] containing the client and scope */
  private readonly stack: Layer[] = [];

  /** Contains the last event id of a captured event.  */
  private _lastEventId?: string;

  /**
   * Creates a new instance of the hub, will push one {@link Layer} into the
   * internal stack on creation.
   *
   * @param client bound to the hub.
   * @param scope bound to the hub.
   * @param version number, higher number means higher priority.
   */
  public constructor(client?: any, scope: Scope = new Scope(), private readonly version: number = API_VERSION) {
    this.stack.push({ client, scope });
  }

  /**
   * Internal helper function to call a method on the top client if it exists.
   *
   * @param method The method to call on the client/client.
   * @param args Arguments to pass to the client/frontend.
   */
  private invokeClient(method: string, ...args: any[]): void {
    const top = this.getStackTop();
    if (top && top.client && top.client[method]) {
      top.client[method](...args, top.scope);
    }
  }

  /**
   * Internal helper function to call an async method on the top client if it
   * exists.
   *
   * @param method The method to call on the client/client.
   * @param args Arguments to pass to the client/frontend.
   */
  private invokeClientAsync(method: string, ...args: any[]): void {
    const top = this.getStackTop();
    if (top && top.client && top.client[method]) {
      top.client[method](...args, top.scope).catch((err: any) => {
        console.error(err);
      });
    }
  }

  /**
   * Checks if this hub's version is older than the given version.
   *
   * @param version A version number to compare to.
   * @return True if the given version is newer; otherwise false.
   */
  public isOlderThan(version: number): boolean {
    return this.version < version;
  }

  /**
   * This binds the given client to the current scope.
   * @param client An SDK client (client) instance.
   */
  public bindClient(client?: any): void {
    const top = this.getStackTop();
    top.client = client;
    if (top && top.scope && client) {
      top.scope.addScopeListener((s: Scope) => {
        if (client.getBackend) {
          try {
            client.getBackend().storeScope(s);
          } catch {
            // Do nothing
          }
        }
      });
    }
  }

  /**
   * Create a new scope to store context information.
   *
   * The scope will be layered on top of the current one. It is isolated, i.e. all
   * breadcrumbs and context information added to this scope will be removed once
   * the scope ends. Be sure to always remove this scope with {@link this.popScope}
   * when the operation finishes or throws.
   *
   * @returns Scope, the new cloned scope
   */
  public pushScope(): Scope {
    // We want to clone the content of prev scope
    const stack = this.getStack();
    const parentScope = stack.length > 0 ? stack[stack.length - 1].scope : undefined;
    const scope = Scope.clone(parentScope);
    this.getStack().push({
      client: this.getClient(),
      scope,
    });
    return scope;
  }

  /**
   * Removes a previously pushed scope from the stack.
   *
   * This restores the state before the scope was pushed. All breadcrumbs and
   * context information added since the last call to {@link this.pushScope} are
   * discarded.
   */
  public popScope(): boolean {
    return this.getStack().pop() !== undefined;
  }

  /**
   * Creates a new scope with and executes the given operation within.
   * The scope is automatically removed once the operation
   * finishes or throws.
   *
   * This is essentially a convenience function for:
   *
   *     pushScope();
   *     callback();
   *     popScope();
   *
   * @param callback that will be enclosed into push/popScope.
   */
  public withScope(callback: ((scope: Scope) => void)): void {
    const scope = this.pushScope();
    try {
      callback(scope);
    } finally {
      this.popScope();
    }
  }

  /** Returns the client of the top stack. */
  public getClient(): any | undefined {
    return this.getStackTop().client;
  }

  /** Returns the scope of the top stack. */
  public getScope(): Scope | undefined {
    return this.getStackTop().scope;
  }

  /** Returns the scope stack for domains or the process. */
  public getStack(): Layer[] {
    return this.stack;
  }

  /** Returns the topmost scope layer in the order domain > local > process. */
  public getStackTop(): Layer {
    return this.stack[this.stack.length - 1];
  }

  /**
   * Captures an exception event and sends it to Sentry.
   *
   * @param exception An exception-like object.
   * @param hint May contain additional information about the original exception.
   * @returns The generated eventId.
   */
  public captureException(exception: any, hint?: SentryEventHint): string {
    const eventId = (this._lastEventId = uuid4());
    this.invokeClientAsync('captureException', exception, {
      ...hint,
      event_id: eventId,
    });
    return eventId;
  }

  /**
   * Captures a message event and sends it to Sentry.
   *
   * @param message The message to send to Sentry.
   * @param level Define the level of the message.
   * @param hint May contain additional information about the original exception.
   * @returns The generated eventId.
   */
  public captureMessage(message: string, level?: Severity, hint?: SentryEventHint): string {
    const eventId = (this._lastEventId = uuid4());
    this.invokeClientAsync('captureMessage', message, level, {
      ...hint,
      event_id: eventId,
    });
    return eventId;
  }

  /**
   * Captures a manually created event and sends it to Sentry.
   *
   * @param event The event to send to Sentry.
   * @param hint May contain additional information about the original exception.
   */
  public captureEvent(event: SentryEvent, hint?: SentryEventHint): string {
    const eventId = (this._lastEventId = uuid4());
    this.invokeClientAsync('captureEvent', event, {
      ...hint,
      event_id: eventId,
    });
    return eventId;
  }

  /**
   * This is the getter for lastEventId.
   *
   * @returns The last event id of a captured event.
   */
  public lastEventId(): string | undefined {
    return this._lastEventId;
  }

  /**
   * Records a new breadcrumb which will be attached to future events.
   *
   * Breadcrumbs will be added to subsequent events to provide more context on
   * user's actions prior to an error or crash.
   *
   * @param breadcrumb The breadcrumb to record.
   * @param hint May contain additional information about the original breadcrumb.
   */
  public addBreadcrumb(breadcrumb: Breadcrumb, hint?: SentryBreadcrumbHint): void {
    this.invokeClient('addBreadcrumb', breadcrumb, { ...hint });
  }

  /**
   * Callback to set context information onto the scope.
   *
   * @param callback Callback function that receives Scope.
   */
  public configureScope(callback: (scope: Scope) => void): void {
    const top = this.getStackTop();
    if (top.scope && top.client) {
      // TODO: freeze flag
      callback(top.scope);
    }
  }
}
