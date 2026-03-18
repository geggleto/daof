/**
 * Returns true if the cron expression would fire in the current minute of the given date.
 * Used by the scheduler to decide which workflows are "due" on each heartbeat.
 */
export declare function isCronDue(expression: string, date?: Date): boolean;
//# sourceMappingURL=cron-due.d.ts.map