import { NextRequest, NextResponse } from "next/server";
import { getRequestUser } from "@/lib/getRequestUser";
import { getProducts, createProduct, updateProduct, deleteProduct, addStock } from "@/lib/productStore";

export async function GET() {
  const user = await getRequestUser();
  if (!user) return NextResponse.json({ error: "Non authentifié." }, { status: 401 });
  return NextResponse.json({ products: getProducts(user.id) });
}

export async function POST(request: NextRequest) {
  const user = await getRequestUser();
  if (!user) return NextResponse.json({ error: "Non authentifié." }, { status: 401 });

  const body = await request.json();
  const { name, sku, image, sellPrice, purchasePrice, stock, minStock } = body;
  if (!name) return NextResponse.json({ error: "Le nom est requis." }, { status: 400 });

  const product = createProduct({
    ownerId: user.id,
    name: String(name).trim(),
    sku: String(sku ?? "").trim(),
    image: String(image ?? ""),
    sellPrice: parseFloat(sellPrice) || 0,
    purchasePrice: parseFloat(purchasePrice) || 0,
    stock: parseInt(stock) || 0,
    minStock: parseInt(minStock) || 5,
  });

  return NextResponse.json({ ok: true, product });
}

export async function PATCH(request: NextRequest) {
  const user = await getRequestUser();
  if (!user) return NextResponse.json({ error: "Non authentifié." }, { status: 401 });

  const body = await request.json();
  const { id, action, qty, ...rest } = body;
  if (!id) return NextResponse.json({ error: "ID requis." }, { status: 400 });

  // Special action: add stock
  if (action === "addStock") {
    const updated = addStock(id, user.id, parseInt(qty) || 0);
    if (!updated) return NextResponse.json({ error: "Produit introuvable." }, { status: 404 });
    return NextResponse.json({ ok: true, product: updated });
  }

  const updated = updateProduct(id, user.id, rest);
  if (!updated) return NextResponse.json({ error: "Produit introuvable." }, { status: 404 });
  return NextResponse.json({ ok: true, product: updated });
}

export async function DELETE(request: NextRequest) {
  const user = await getRequestUser();
  if (!user) return NextResponse.json({ error: "Non authentifié." }, { status: 401 });

  const body = await request.json();
  const { id } = body;
  if (!id) return NextResponse.json({ error: "ID requis." }, { status: 400 });

  const ok = deleteProduct(id, user.id);
  if (!ok) return NextResponse.json({ error: "Produit introuvable." }, { status: 404 });
  return NextResponse.json({ ok: true });
}
