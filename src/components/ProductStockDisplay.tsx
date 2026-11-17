import Image from "next/image";

export function ProductImage({ image, name, size = 48 }: { image: string; name: string; size?: number }) {
  const colors = ["bg-blue-500", "bg-violet-500", "bg-emerald-500", "bg-amber-500", "bg-rose-500"];
  const color = colors[(name.charCodeAt(0) || 0) % colors.length];
  if (image) return (
    <div className="rounded-xl overflow-hidden bg-slate-100 shrink-0" style={{ width: size, height: size }}>
      <Image src={image} alt={name} width={size} height={size} className="object-cover w-full h-full" unoptimized />
    </div>
  );
  return (
    <div className={`${color} rounded-xl flex items-center justify-center text-white font-bold shrink-0`} style={{ width: size, height: size, fontSize: size * 0.3 }}>
      {name.slice(0, 2).toUpperCase()}
    </div>
  );
}

export function StockBadge({ stock, minStock }: { stock: number; minStock: number }) {
  if (stock === 0) return <span className="text-xs font-bold px-2.5 py-1 rounded-xl bg-red-100 text-red-600">Rupture</span>;
  if (stock <= minStock) return <span className="text-xs font-bold px-2.5 py-1 rounded-xl bg-amber-100 text-amber-700">Stock bas · {stock}</span>;
  return <span className="text-xs font-bold px-2.5 py-1 rounded-xl bg-emerald-100 text-emerald-700">{stock} en stock</span>;
}
