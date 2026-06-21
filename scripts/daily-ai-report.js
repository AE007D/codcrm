// Called by PM2 cron every day at 8pm — sends AI daily report to all workspaces via Telegram
const CRM_URL = process.env.CRM_URL ?? "http://127.0.0.1:3000";
const TOKEN = process.env.WA_INTERNAL_TOKEN ?? "codcrm-wa-secret-2024";

async function run() {
  console.log(`[daily-ai-report] ${new Date().toISOString()} — running...`);
  try {
    const res = await fetch(`${CRM_URL}/api/ai-advisor/daily-report`, {
      method: "POST",
      headers: { "x-internal-token": TOKEN, "Content-Type": "application/json" },
    });
    const data = await res.json();
    console.log("[daily-ai-report] done:", JSON.stringify(data));
  } catch (e) {
    console.error("[daily-ai-report] error:", e);
  }
}

run();
