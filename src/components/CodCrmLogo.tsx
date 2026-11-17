import Image from "next/image";

export function CodCrmWordmark({ width, onDark = false }: { width: number; onDark?: boolean }) {
  const height = Math.round(width * 126 / 600);

  if (onDark) {
    return <Image src="/codcrm-logo-dark.webp" alt="CODCRM.ma" width={width} height={height} className="h-auto max-w-full" />;
  }

  return (
    <>
      <Image src="/codcrm-logo-light.webp" alt="CODCRM.ma" width={width} height={height} className="codcrm-logo-light h-auto max-w-full" />
      <Image src="/codcrm-logo-dark.webp" alt="CODCRM.ma" width={width} height={height} className="codcrm-logo-dark h-auto max-w-full" />
    </>
  );
}
