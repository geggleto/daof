import { readFileSync, writeFileSync, unlinkSync, existsSync } from "fs";
import { resolve } from "path";
const DEFAULT_PID_FILE = "daof.pid";
export function getPidFilePath(pidFileOption) {
    return pidFileOption ? resolve(pidFileOption) : resolve(process.cwd(), DEFAULT_PID_FILE);
}
export function isProcessAlive(pid) {
    try {
        process.kill(pid, 0);
        return true;
    }
    catch {
        return false;
    }
}
export function readPidFile(path) {
    if (!existsSync(path))
        return null;
    try {
        const raw = readFileSync(path, "utf8").trim();
        const pid = parseInt(raw, 10);
        return Number.isFinite(pid) ? pid : null;
    }
    catch {
        return null;
    }
}
export function writePidFile(path) {
    writeFileSync(path, String(process.pid), "utf8");
}
export function removePidFile(path) {
    try {
        if (existsSync(path))
            unlinkSync(path);
    }
    catch {
        // ignore
    }
}
export function checkAlreadyRunning(pidFilePath) {
    const pid = readPidFile(pidFilePath);
    if (pid !== null && isProcessAlive(pid)) {
        console.error(`Already running (PID ${pid}). Stop the existing process or remove ${pidFilePath}.`);
        process.exit(1);
    }
}
//# sourceMappingURL=pidfile.js.map