import { NextResponse } from "next/server";

// Stores last 5 received payloads in memory
declare global {
  var __webhookDebugLog: { ts: string; body: unknown }[] | undefined;
}

export function storeDebugPayload(body: unknown) {
  if (!globalThis.__webhookDebugLog) globalThis.__webhookDebugLog = [];
  globalThis.__webhookDebugLog.unshift({ ts: new Date().toISOString(), body });
  globalThis.__webhookDebugLog = globalThis.__webhookDebugLog.slice(0, 5);
}

export async function GET() {
  return NextResponse.json({
    payloads: globalThis.__webhookDebugLog ?? [],
    hint: "Send dummy from Lightfunnels then refresh this page",
  });
}
