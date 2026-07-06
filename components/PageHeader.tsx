"use client";

import { useRouter } from "next/navigation";

export default function PageHeader({
  title,
  backHref,
}: {
  title: string;
  backHref?: string;
}) {
  const router = useRouter();

  return (
    <div className="flex flex-shrink-0 items-center gap-3 border-b border-[#F0F2F5] bg-white px-5 py-3.5">
      <button
        onClick={() => (backHref ? router.push(backHref) : router.back())}
        className="flex items-center text-[22px] text-ink"
      >
        <i className="ti ti-arrow-left" />
      </button>
      <h3 className="text-base font-bold text-ink">{title}</h3>
    </div>
  );
}
