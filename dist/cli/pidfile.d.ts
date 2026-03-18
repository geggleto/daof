export declare function getPidFilePath(pidFileOption?: string): string;
export declare function isProcessAlive(pid: number): boolean;
export declare function readPidFile(path: string): number | null;
export declare function writePidFile(path: string): void;
export declare function removePidFile(path: string): void;
export declare function checkAlreadyRunning(pidFilePath: string): void;
//# sourceMappingURL=pidfile.d.ts.map