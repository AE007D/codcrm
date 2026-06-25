import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json(
    { error: "Les inscriptions sont fermées. Contactez-nous sur WhatsApp : +212644587812" },
    { status: 403 }
  );
}
