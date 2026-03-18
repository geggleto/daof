import { CronExpressionParser } from "cron-parser";
/**
 * Returns true if the cron expression would fire in the current minute of the given date.
 * Used by the scheduler to decide which workflows are "due" on each heartbeat.
 */
export function isCronDue(expression, date = new Date()) {
    try {
        const startOfMinute = new Date(date);
        startOfMinute.setSeconds(0, 0);
        startOfMinute.setMilliseconds(0);
        const expr = CronExpressionParser.parse(expression, {
            currentDate: startOfMinute,
        });
        return expr.includesDate(startOfMinute);
    }
    catch {
        return false;
    }
}
//# sourceMappingURL=cron-due.js.map