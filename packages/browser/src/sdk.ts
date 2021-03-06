import { getCurrentHub, initAndBind, Integrations as CoreIntegrations } from '@sentry/core';
import { DsnLike } from '@sentry/types';
import { BrowserOptions } from './backend';
import { BrowserClient } from './client';
import { Breadcrumbs, GlobalHandlers, LinkedErrors, ReportingObserver, TryCatch, UserAgent } from './integrations';
import { SDK_NAME, SDK_VERSION } from './version';

export const defaultIntegrations = [
  // Common
  new CoreIntegrations.Dedupe(),
  new CoreIntegrations.InboundFilters(),
  new CoreIntegrations.FunctionToString(),
  new CoreIntegrations.SDKInformation({
    name: 'npm:@sentry/browser',
    sdkName: SDK_NAME,
    sdkVersion: SDK_VERSION,
  }),
  // Native Wrappers
  new TryCatch(),
  new Breadcrumbs(),
  // Global Handlers
  new GlobalHandlers(),
  new ReportingObserver(),
  // Misc
  new LinkedErrors(),
  new UserAgent(),
];

/**
 * The Sentry Browser SDK Client.
 *
 * To use this SDK, call the {@link init} function as early as possible when
 * loading the web page. To set context information or send manual events, use
 * the provided methods.
 *
 * @example
 * import { init } from '@sentry/browser';
 *
 * init({
 *   dsn: '__DSN__',
 *   // ...
 * });
 *
 * @example
 * import { configureScope } from '@sentry/browser';
 * configureScope((scope: Scope) => {
 *   scope.setExtra({ battery: 0.7 });
 *   scope.setTags({ user_mode: 'admin' });
 *   scope.setUser({ id: '4711' });
 * });
 *
 * @example
 * import { addBreadcrumb } from '@sentry/browser';
 * addBreadcrumb({
 *   message: 'My Breadcrumb',
 *   // ...
 * });
 *
 * @example
 * import * as Sentry from '@sentry/browser';
 * Sentry.captureMessage('Hello, world!');
 * Sentry.captureException(new Error('Good bye'));
 * Sentry.captureEvent({
 *   message: 'Manual',
 *   stacktrace: [
 *     // ...
 *   ],
 * });
 *
 * @see BrowserOptions for documentation on configuration options.
 */
export function init(options: BrowserOptions): void {
  initAndBind(BrowserClient, options, defaultIntegrations);
}

/**
 * Present the user with a report dialog.
 *
 * @param options Everything is optional, we try to fetch all info need from the global scope.
 */
export function showReportDialog(
  options: {
    [key: string]: any;
    eventId?: string;
    dsn?: DsnLike;
    user?: {
      email?: string;
      name?: string;
    };
    lang?: string;
    title?: string;
    subtitle?: string;
    subtitle2?: string;
    labelName?: string;
    labelEmail?: string;
    labelComments?: string;
    labelClose?: string;
    labelSubmit?: string;
    errorGeneric?: string;
    errorFormEntry?: string;
    successMessage?: string;
  } = {},
): void {
  if (!options.eventId) {
    options.eventId = getCurrentHub().lastEventId();
  }
  (getCurrentHub().getClient() as BrowserClient).showReportDialog(options);
}

/**
 * This is the getter for lastEventId.
 *
 * @returns The last event id of a captured event.
 */
export function lastEventId(): string | undefined {
  return getCurrentHub().lastEventId();
}

/**
 * This function is here to be API compatible with the loader
 */
export function forceLoad(): void {
  // Noop
}

/**
 * This function is here to be API compatible with the loader
 */
export function onLoad(callback: () => void): void {
  callback();
}
