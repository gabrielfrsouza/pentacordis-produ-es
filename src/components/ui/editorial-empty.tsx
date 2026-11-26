import type { ReactNode } from "react";
import { BrandMark } from "@/components/brand/BrandMark";
import { EditorialDivider } from "@/components/brand/editorial-divider";

type EditorialEmptyProps = {
  title: string;
  description?: string;
  action?: ReactNode;
};

export function EditorialEmpty({ title, description, action }: EditorialEmptyProps) {
  return (
    <div className="grid min-h-64 place-items-center px-6 py-10 text-center">
      <div className="max-w-sm">
        <BrandMark variant="muted" size="lg" className="mx-auto" />
        <EditorialDivider className="my-5" />
        <p className="font-light text-2xl">{title}</p>
        {description ? <p className="mt-2 text-sm text-neutral-500">{description}</p> : null}
        {action ? <div className="mt-5">{action}</div> : null}
      </div>
    </div>
  );
}
