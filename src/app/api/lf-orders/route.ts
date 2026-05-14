import { NextResponse } from "next/server";
import { getOrders, getEventCount } from "@/lib/orderStore";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({
    orders: getOrders(),
    total: getOrders().length,
    events: getEventCount(),
  });
}
