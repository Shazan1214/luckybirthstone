import { objectStorageClient } from "./objectStorage.js";
import { logger } from "./logger.js";

function parseObjectPath(path: string): { bucketName: string; objectName: string } {
  if (!path.startsWith("/")) path = `/${path}`;
  const parts = path.split("/").filter(Boolean);
  return {
    bucketName: parts[0] ?? "",
    objectName: parts.slice(1).join("/"),
  };
}

interface DataPaths {
  bucketName: string;
  usersKey: string;
  inventoryKey: string;
  messagesKey: string;
  supportTicketsKey: string;
  ticketResponsesKey: string;
  transactionsKey: string;
  salesKey: string;
  platformPaymentsKey: string;
  postsKey: string;
  auctionsKey: string;
  bidsKey: string;
  referralsKey: string;
  crmKey: string;
  salesUsersKey: string;
  endorsementsKey: string;
  connectionsKey: string;
  creditsKey: string;
  dealsKey: string;
  activitiesKey: string;
  disputesKey: string;
  approvalsKey: string;
  partnerListingsKey: string;
  tradeContactsKey: string;
  tradeDealsKey: string;
  tradeInvoicesKey: string;
  tradePaymentsKey: string;
  salesLedgerKey: string;
  payablesLedgerKey: string;
  ledgerPaymentsKey: string;
  astrobotLeadsKey: string;
}

function getDataPaths(): DataPaths | null {
  const envDir = process.env.PRIVATE_OBJECT_DIR;
  if (!envDir) return null;
  const { bucketName, objectName } = parseObjectPath(envDir);
  if (!bucketName) return null;
  const base = objectName ? `${objectName}/lbs-data` : "lbs-data";
  return {
    bucketName,
    usersKey: `${base}/users.json`,
    inventoryKey: `${base}/inventory.json`,
    messagesKey: `${base}/messages.json`,
    supportTicketsKey: `${base}/support_tickets.json`,
    ticketResponsesKey: `${base}/ticket_responses.json`,
    transactionsKey: `${base}/transactions.json`,
    salesKey: `${base}/sales.json`,
    platformPaymentsKey: `${base}/platform_payments.json`,
    postsKey: `${base}/posts.json`,
    auctionsKey: `${base}/auctions.json`,
    bidsKey: `${base}/bids.json`,
    referralsKey: `${base}/referrals.json`,
    crmKey: `${base}/crm.json`,
    salesUsersKey: `${base}/sales_users.json`,
    endorsementsKey: `${base}/endorsements.json`,
    connectionsKey: `${base}/connections.json`,
    creditsKey: `${base}/credits.json`,
    dealsKey: `${base}/deals.json`,
    activitiesKey: `${base}/activities.json`,
    disputesKey: `${base}/disputes.json`,
    approvalsKey: `${base}/approvals.json`,
    partnerListingsKey: `${base}/partner_listings.json`,
    tradeContactsKey: `${base}/trade_contacts.json`,
    tradeDealsKey: `${base}/trade_deals.json`,
    tradeInvoicesKey: `${base}/trade_invoices.json`,
    tradePaymentsKey: `${base}/trade_payments.json`,
    salesLedgerKey: `${base}/sales_ledger.json`,
    payablesLedgerKey: `${base}/payables_ledger.json`,
    ledgerPaymentsKey: `${base}/ledger_payments.json`,
    astrobotLeadsKey: `${base}/astrobot_leads.json`,
  };
}

async function gcsRead(bucketName: string, key: string): Promise<unknown[] | null> {
  try {
    const file = objectStorageClient.bucket(bucketName).file(key);
    const [exists] = await file.exists();
    if (!exists) return null;
    const [content] = await file.download();
    return JSON.parse(content.toString()) as unknown[];
  } catch (e) {
    logger.error({ err: e, key }, "persist: GCS read error");
    return null;
  }
}

async function gcsWrite(bucketName: string, key: string, data: unknown[]): Promise<void> {
  try {
    const file = objectStorageClient.bucket(bucketName).file(key);
    await file.save(JSON.stringify(data, null, 2), { contentType: "application/json" });
  } catch (e) {
    logger.error({ err: e, key }, "persist: GCS write error");
  }
}

// ─── Load functions ──────────────────────────────────────────────────────────

export async function loadPersistedUsers(): Promise<unknown[]> {
  const paths = getDataPaths();
  if (!paths) {
    logger.warn("persist: PRIVATE_OBJECT_DIR not set — data will not survive restarts");
    return [];
  }
  const data = await gcsRead(paths.bucketName, paths.usersKey);
  logger.info({ count: data?.length ?? 0, key: paths.usersKey }, "persist: loaded users");
  return data ?? [];
}

export async function loadPersistedInventory(): Promise<unknown[]> {
  const paths = getDataPaths();
  if (!paths) return [];
  const data = await gcsRead(paths.bucketName, paths.inventoryKey);
  logger.info({ count: data?.length ?? 0, key: paths.inventoryKey }, "persist: loaded inventory");
  return data ?? [];
}

export async function loadPersistedMessages(): Promise<unknown[]> {
  const paths = getDataPaths();
  if (!paths) return [];
  const data = await gcsRead(paths.bucketName, paths.messagesKey);
  logger.info({ count: data?.length ?? 0, key: paths.messagesKey }, "persist: loaded messages");
  return data ?? [];
}

export async function loadPersistedSupportTickets(): Promise<unknown[]> {
  const paths = getDataPaths();
  if (!paths) return [];
  const data = await gcsRead(paths.bucketName, paths.supportTicketsKey);
  logger.info({ count: data?.length ?? 0, key: paths.supportTicketsKey }, "persist: loaded support tickets");
  return data ?? [];
}

export async function loadPersistedTicketResponses(): Promise<unknown[]> {
  const paths = getDataPaths();
  if (!paths) return [];
  const data = await gcsRead(paths.bucketName, paths.ticketResponsesKey);
  logger.info({ count: data?.length ?? 0, key: paths.ticketResponsesKey }, "persist: loaded ticket responses");
  return data ?? [];
}

export async function loadPersistedTransactions(): Promise<unknown[]> {
  const paths = getDataPaths();
  if (!paths) return [];
  const data = await gcsRead(paths.bucketName, paths.transactionsKey);
  logger.info({ count: data?.length ?? 0, key: paths.transactionsKey }, "persist: loaded transactions");
  return data ?? [];
}

export async function loadPersistedSales(): Promise<unknown[]> {
  const paths = getDataPaths();
  if (!paths) return [];
  const data = await gcsRead(paths.bucketName, paths.salesKey);
  logger.info({ count: data?.length ?? 0, key: paths.salesKey }, "persist: loaded sales");
  return data ?? [];
}

// ─── Save functions (fire-and-forget) ───────────────────────────────────────

function fireSave(key: keyof DataPaths, label: string, data: unknown[]): void {
  const paths = getDataPaths();
  if (!paths) return;
  void gcsWrite(paths.bucketName, paths[key] as string, data).catch((e) =>
    logger.error({ err: e }, `persist: ${label} save failed`)
  );
}

export function saveUsers(users: unknown[]): void {
  fireSave("usersKey", "saveUsers", users);
}

export function saveInventory(inventory: unknown[]): void {
  fireSave("inventoryKey", "saveInventory", inventory);
}

export function saveMessages(messages: unknown[]): void {
  fireSave("messagesKey", "saveMessages", messages);
}

export function saveSupportTickets(tickets: unknown[]): void {
  fireSave("supportTicketsKey", "saveSupportTickets", tickets);
}

export function saveTicketResponses(responses: unknown[]): void {
  fireSave("ticketResponsesKey", "saveTicketResponses", responses);
}

export function saveTransactions(transactions: unknown[]): void {
  fireSave("transactionsKey", "saveTransactions", transactions);
}

export function saveSales(sales: unknown[]): void {
  fireSave("salesKey", "saveSales", sales);
}

export async function loadPersistedPlatformPayments(): Promise<unknown[]> {
  const paths = getDataPaths();
  if (!paths) return [];
  const data = await gcsRead(paths.bucketName, paths.platformPaymentsKey);
  logger.info({ count: data?.length ?? 0, key: paths.platformPaymentsKey }, "persist: loaded platform payments");
  return data ?? [];
}

export function savePlatformPayments(payments: unknown[]): void {
  fireSave("platformPaymentsKey", "savePlatformPayments", payments);
}

export async function loadPersistedPosts(): Promise<unknown[]> {
  const paths = getDataPaths();
  if (!paths) return [];
  const data = await gcsRead(paths.bucketName, paths.postsKey);
  logger.info({ count: data?.length ?? 0, key: paths.postsKey }, "persist: loaded posts");
  return data ?? [];
}

export function savePosts(posts: unknown[]): void {
  fireSave("postsKey", "savePosts", posts);
}

export async function loadPersistedAuctions(): Promise<unknown[]> {
  const paths = getDataPaths();
  if (!paths) return [];
  const data = await gcsRead(paths.bucketName, paths.auctionsKey);
  logger.info({ count: data?.length ?? 0, key: paths.auctionsKey }, "persist: loaded auctions");
  return data ?? [];
}

export function saveAuctions(auctions: unknown[]): void {
  fireSave("auctionsKey", "saveAuctions", auctions);
}

export async function loadPersistedBids(): Promise<unknown[]> {
  const paths = getDataPaths();
  if (!paths) return [];
  const data = await gcsRead(paths.bucketName, paths.bidsKey);
  logger.info({ count: data?.length ?? 0, key: paths.bidsKey }, "persist: loaded bids");
  return data ?? [];
}

export function saveBids(bids: unknown[]): void {
  fireSave("bidsKey", "saveBids", bids);
}

export async function loadPersistedReferrals(): Promise<unknown[]> {
  const paths = getDataPaths();
  if (!paths) return [];
  const data = await gcsRead(paths.bucketName, paths.referralsKey);
  logger.info({ count: data?.length ?? 0, key: paths.referralsKey }, "persist: loaded referrals");
  return data ?? [];
}

export function saveReferrals(referrals: unknown[]): void {
  fireSave("referralsKey", "saveReferrals", referrals);
}

// ─── Periodic full backup (every 5 minutes) ──────────────────────────────────
// Guards against any missed individual saves (e.g. process killed mid-request).

type DataGetter = {
  users: () => unknown[];
  inventory: () => unknown[];
  messages: () => unknown[];
  supportTickets: () => unknown[];
  ticketResponses: () => unknown[];
  transactions: () => unknown[];
  sales: () => unknown[];
  auctions?: () => unknown[];
  bids?: () => unknown[];
  referrals?: () => unknown[];
  endorsements?: () => unknown[];
  connections?: () => unknown[];
  credits?: () => unknown[];
  deals?: () => unknown[];
  activities?: () => unknown[];
  disputes?: () => unknown[];
  approvals?: () => unknown[];
  partnerListings?: () => unknown[];
  tradeContacts?: () => unknown[];
  tradeDeals?: () => unknown[];
  tradeInvoices?: () => unknown[];
  tradePayments?: () => unknown[];
  astrobotLeads?: () => unknown[];
};

let periodicBackupTimer: ReturnType<typeof setInterval> | null = null;

export function startPeriodicBackup(getters: DataGetter): void {
  if (periodicBackupTimer) return;
  const INTERVAL_MS = 5 * 60 * 1000; // 5 minutes
  periodicBackupTimer = setInterval(() => {
    const paths = getDataPaths();
    if (!paths) return;
    logger.info("persist: running periodic full backup");
    void gcsWrite(paths.bucketName, paths.usersKey, getters.users());
    void gcsWrite(paths.bucketName, paths.inventoryKey, getters.inventory());
    void gcsWrite(paths.bucketName, paths.messagesKey, getters.messages());
    void gcsWrite(paths.bucketName, paths.supportTicketsKey, getters.supportTickets());
    void gcsWrite(paths.bucketName, paths.ticketResponsesKey, getters.ticketResponses());
    void gcsWrite(paths.bucketName, paths.transactionsKey, getters.transactions());
    void gcsWrite(paths.bucketName, paths.salesKey, getters.sales());
    if (getters.auctions) void gcsWrite(paths.bucketName, paths.auctionsKey, getters.auctions());
    if (getters.bids) void gcsWrite(paths.bucketName, paths.bidsKey, getters.bids());
    if (getters.referrals) void gcsWrite(paths.bucketName, paths.referralsKey, getters.referrals());
    if (getters.endorsements) void gcsWrite(paths.bucketName, paths.endorsementsKey, getters.endorsements());
    if (getters.connections) void gcsWrite(paths.bucketName, paths.connectionsKey, getters.connections());
    if (getters.credits) void gcsWrite(paths.bucketName, paths.creditsKey, getters.credits());
    if (getters.deals) void gcsWrite(paths.bucketName, paths.dealsKey, getters.deals());
    if (getters.activities) void gcsWrite(paths.bucketName, paths.activitiesKey, getters.activities());
    if (getters.disputes) void gcsWrite(paths.bucketName, paths.disputesKey, getters.disputes());
    if (getters.approvals) void gcsWrite(paths.bucketName, paths.approvalsKey, getters.approvals());
    if (getters.partnerListings) void gcsWrite(paths.bucketName, paths.partnerListingsKey, getters.partnerListings());
    if (getters.tradeContacts) void gcsWrite(paths.bucketName, paths.tradeContactsKey, getters.tradeContacts());
    if (getters.tradeDeals) void gcsWrite(paths.bucketName, paths.tradeDealsKey, getters.tradeDeals());
    if (getters.tradeInvoices) void gcsWrite(paths.bucketName, paths.tradeInvoicesKey, getters.tradeInvoices());
    if (getters.tradePayments) void gcsWrite(paths.bucketName, paths.tradePaymentsKey, getters.tradePayments());
    if (getters.astrobotLeads) void gcsWrite(paths.bucketName, paths.astrobotLeadsKey, getters.astrobotLeads());
  }, INTERVAL_MS);
  periodicBackupTimer.unref?.(); // don't block process exit
}

export async function loadPersistedCRM(): Promise<unknown[]> {
  const paths = getDataPaths();
  if (!paths) return [];
  const data = await gcsRead(paths.bucketName, paths.crmKey);
  logger.info({ count: data?.length ?? 0, key: paths.crmKey }, "persist: loaded CRM prospects");
  return data ?? [];
}

export function saveCRM(prospects: unknown[]): void {
  fireSave("crmKey", "saveCRM", prospects);
}

export async function loadPersistedSalesUsers(): Promise<unknown[]> {
  const paths = getDataPaths();
  if (!paths) return [];
  const data = await gcsRead(paths.bucketName, paths.salesUsersKey);
  logger.info({ count: data?.length ?? 0, key: paths.salesUsersKey }, "persist: loaded sales users");
  return data ?? [];
}

export function saveSalesUsers(salesUsers: unknown[]): void {
  fireSave("salesUsersKey", "saveSalesUsers", salesUsers);
}

export async function loadPersistedEndorsements(): Promise<unknown[]> {
  const paths = getDataPaths();
  if (!paths) return [];
  const data = await gcsRead(paths.bucketName, paths.endorsementsKey);
  logger.info({ count: data?.length ?? 0, key: paths.endorsementsKey }, "persist: loaded endorsements");
  return data ?? [];
}

export function saveEndorsements(endorsements: unknown[]): void {
  fireSave("endorsementsKey", "saveEndorsements", endorsements);
}

export async function loadPersistedConnections(): Promise<unknown[]> {
  const paths = getDataPaths();
  if (!paths) return [];
  return (await gcsRead(paths.bucketName, paths.connectionsKey)) ?? [];
}
export function saveConnections(data: unknown[]): void {
  fireSave("connectionsKey", "saveConnections", data);
}

export async function loadPersistedCredits(): Promise<unknown[]> {
  const paths = getDataPaths();
  if (!paths) return [];
  return (await gcsRead(paths.bucketName, paths.creditsKey)) ?? [];
}
export function saveCredits(data: unknown[]): void {
  fireSave("creditsKey", "saveCredits", data);
}

export async function loadPersistedDeals(): Promise<unknown[]> {
  const paths = getDataPaths();
  if (!paths) return [];
  return (await gcsRead(paths.bucketName, paths.dealsKey)) ?? [];
}
export function saveDeals(data: unknown[]): void {
  fireSave("dealsKey", "saveDeals", data);
}

export async function loadPersistedActivities(): Promise<unknown[]> {
  const paths = getDataPaths();
  if (!paths) return [];
  return (await gcsRead(paths.bucketName, paths.activitiesKey)) ?? [];
}
export function saveActivities(data: unknown[]): void {
  fireSave("activitiesKey", "saveActivities", data);
}

export async function loadPersistedDisputes(): Promise<unknown[]> {
  const paths = getDataPaths();
  if (!paths) return [];
  return (await gcsRead(paths.bucketName, paths.disputesKey)) ?? [];
}
export function saveDisputes(data: unknown[]): void {
  fireSave("disputesKey", "saveDisputes", data);
}

export async function loadPersistedApprovals(): Promise<unknown[]> {
  const paths = getDataPaths();
  if (!paths) return [];
  return (await gcsRead(paths.bucketName, paths.approvalsKey)) ?? [];
}
export function saveApprovals(data: unknown[]): void {
  fireSave("approvalsKey", "saveApprovals", data);
}

export async function loadPersistedPartnerListings(): Promise<unknown[]> {
  const paths = getDataPaths();
  if (!paths) return [];
  return (await gcsRead(paths.bucketName, paths.partnerListingsKey)) ?? [];
}
export function savePartnerListings(data: unknown[]): void {
  fireSave("partnerListingsKey", "savePartnerListings", data);
}

export async function loadTradeContacts(): Promise<unknown[]> {
  const paths = getDataPaths();
  if (!paths) return [];
  return (await gcsRead(paths.bucketName, paths.tradeContactsKey)) ?? [];
}
export function saveTradeContacts(data: unknown[]): void {
  fireSave("tradeContactsKey", "saveTradeContacts", data);
}

export async function loadTradeDeals(): Promise<unknown[]> {
  const paths = getDataPaths();
  if (!paths) return [];
  return (await gcsRead(paths.bucketName, paths.tradeDealsKey)) ?? [];
}
export function saveTradeDeals(data: unknown[]): void {
  fireSave("tradeDealsKey", "saveTradeDeals", data);
}

export async function loadTradeInvoices(): Promise<unknown[]> {
  const paths = getDataPaths();
  if (!paths) return [];
  return (await gcsRead(paths.bucketName, paths.tradeInvoicesKey)) ?? [];
}
export function saveTradeInvoices(data: unknown[]): void {
  fireSave("tradeInvoicesKey", "saveTradeInvoices", data);
}

export async function loadTradePayments(): Promise<unknown[]> {
  const paths = getDataPaths();
  if (!paths) return [];
  return (await gcsRead(paths.bucketName, paths.tradePaymentsKey)) ?? [];
}
export function saveTradePayments(data: unknown[]): void {
  fireSave("tradePaymentsKey", "saveTradePayments", data);
}

export async function loadSalesLedger(): Promise<unknown[]> {
  const paths = getDataPaths();
  if (!paths) return [];
  return (await gcsRead(paths.bucketName, paths.salesLedgerKey)) ?? [];
}
export function saveSalesLedger(data: unknown[]): void {
  fireSave("salesLedgerKey", "saveSalesLedger", data);
}

export async function loadPayablesLedger(): Promise<unknown[]> {
  const paths = getDataPaths();
  if (!paths) return [];
  return (await gcsRead(paths.bucketName, paths.payablesLedgerKey)) ?? [];
}
export function savePayablesLedger(data: unknown[]): void {
  fireSave("payablesLedgerKey", "savePayablesLedger", data);
}

export async function loadLedgerPayments(): Promise<unknown[]> {
  const paths = getDataPaths();
  if (!paths) return [];
  return (await gcsRead(paths.bucketName, paths.ledgerPaymentsKey)) ?? [];
}
export function saveLedgerPayments(data: unknown[]): void {
  fireSave("ledgerPaymentsKey", "saveLedgerPayments", data);
}

export async function loadAstrobotLeads(): Promise<unknown[]> {
  const paths = getDataPaths();
  if (!paths) return [];
  return (await gcsRead(paths.bucketName, paths.astrobotLeadsKey)) ?? [];
}
export function saveAstrobotLeads(data: unknown[]): void {
  fireSave("astrobotLeadsKey", "saveAstrobotLeads", data);
}
