import { NextResponse } from "next/server";
import { getOrders, getEventCount } from "@/lib/orderStore";
import { getRequestUser } from "@/lib/getRequestUser";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getRequestUser();
  if (!user) return NextResponse.json({ error: "Non authentifié." }, { status: 401 });

  const orders = getOrders(user.workspaceId);
  return NextResponse.json({
    orders,
    total: orders.length,
    events: getEventCount(),
  });
}
