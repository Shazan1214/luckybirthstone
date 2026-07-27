import app from "./app";
import { logger } from "./lib/logger";
import { checkPaymentReminders } from "./routes/trader-crm.js";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

const server = app.listen(port, () => {
  logger.info({ port }, "Server listening");
});

// Cloudflare keeps connections open for up to 100 seconds.
// Node.js defaults keepAliveTimeout to 5 seconds, which causes a race condition
// where Cloudflare reuses a connection that Node has already closed — resulting
// in "This store is unavailable" errors. Setting these above Cloudflare's timeout
// prevents TCP RST errors and eliminates the intermittent unavailability.
server.keepAliveTimeout = 110 * 1000; // 110 seconds (above Cloudflare's 100s)
server.headersTimeout = 115 * 1000;   // must be > keepAliveTimeout

// Run payment reminder check once on startup and then every hour
void checkPaymentReminders();
const reminderInterval = setInterval(() => void checkPaymentReminders(), 60 * 60 * 1000);
reminderInterval.unref();
