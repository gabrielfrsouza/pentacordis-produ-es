import { BrandMark } from "./BrandMark";

export function EditorialDivider({ className = "" }: { className?: string }) {
  return (
    <div className={`flex items-center gap-3 ${className}`} aria-hidden="true">
      <span className="h-px flex-1 bg-neutral-200" />
      <BrandMark variant="muted" size="xs" />
      <span className="h-px flex-1 bg-neutral-200" />
    </div>
  );
}
