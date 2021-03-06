import { captureMessage, withScope } from '@sentry/core';
import { Integration } from '@sentry/types';
import { getGlobalObject } from '@sentry/utils/misc';
import { supportsReportingObserver } from '@sentry/utils/supports';

/** JSDoc */
interface Report {
  [key: string]: any;
  type: ReportTypes;
  url: string;
  body?: ReportBody;
}

/** JSDoc */
enum ReportTypes {
  /** JSDoc */
  Crash = 'crash',
  /** JSDoc */
  Deprecation = 'deprecation',
  /** JSDoc */
  Intervention = 'intervention',
}

/** JSDoc */
type ReportBody = CrashReportBody | DeprecationReportBody | InterventionReportBody;

/** JSDoc */
interface CrashReportBody {
  [key: string]: any;
  crashId: string;
  reason?: string;
}

/** JSDoc */
interface DeprecationReportBody {
  [key: string]: any;
  id: string;
  anticipatedRemoval?: Date;
  message: string;
  sourceFile?: string;
  lineNumber?: number;
  columnNumber?: number;
}

/** JSDoc */
interface InterventionReportBody {
  [key: string]: any;
  id: string;
  message: string;
  sourceFile?: string;
  lineNumber?: number;
  columnNumber?: number;
}

/** Reporting API integration - https://w3c.github.io/reporting/ */
export class ReportingObserver implements Integration {
  /**
   * @inheritDoc
   */
  public readonly name: string = 'ReportingObserver';

  /**
   * @inheritDoc
   */
  public constructor(
    private readonly config: {
      types?: ReportTypes[];
    } = {
      types: [ReportTypes.Crash, ReportTypes.Deprecation, ReportTypes.Intervention],
    },
  ) {}

  /**
   * @inheritDoc
   */
  public install(): void {
    if (!supportsReportingObserver()) {
      return;
    }

    const observer = new (getGlobalObject() as {
      ReportingObserver: any;
    }).ReportingObserver(this.handler.bind(this), {
      buffered: true,
      types: this.config.types,
    });

    observer.observe();
  }

  /**
   * @inheritDoc
   */
  public handler(reports: Report[]): void {
    for (const report of reports) {
      withScope(scope => {
        scope.setExtra('url', report.url);

        const label = `ReportingObserver [${report.type}]`;
        let details = 'No details available';

        if (report.body) {
          // Object.keys doesn't work on ReportBody, as all properties are inheirted
          const plainBody: {
            [key: string]: any;
          } = {};

          // tslint:disable-next-line:forin
          for (const prop in report.body) {
            plainBody[prop] = report.body[prop];
          }

          scope.setExtra('body', plainBody);

          if (report.type === ReportTypes.Crash) {
            const body = report.body as CrashReportBody;
            details = `${body.crashId} ${body.reason}`;
          } else {
            const body = report.body as DeprecationReportBody | InterventionReportBody;
            details = body.message;
          }
        }

        captureMessage(`${label}: ${details}`);
      });
    }
  }
}
