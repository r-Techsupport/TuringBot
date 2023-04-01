import { describe, it } from "node:test";
import chalk from "chalk";

import { EventLogger } from "../core/logger";

console.log("from tests: " + typeof EventLogger)
let eventLogger = new EventLogger();
describe("testing logging", () => {
    it("should support color", () => {
        if (!chalk.supportsColor) throw "This terminal does not support color";
    });
    it("should log an information event", () => {
        eventLogger.logEvent(
            {
                location: "testing",
                description: "logging an information event",
                category: "II",
            },
            3
        );
    });

    it("should log a warning event", () => {
        eventLogger.logEvent(
            {
                location: "testing",
                description: "logging a warning event",
                category: "WW",
            },
            3
        );
    });

    it("should log an error event", () => {
        eventLogger.logEvent(
            {
                location: "testing",
                description: "logging an error event",
                category: "EE",
            },
            3
        );
    });
});
