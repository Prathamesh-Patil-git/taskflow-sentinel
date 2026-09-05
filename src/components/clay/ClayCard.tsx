import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function ClayCard({
  children,
  className,
  hover = false,
  as: Tag = "section",
}: {
  children: ReactNode;
  className?: string;
  hover?: boolean;
  as?: "section" | "div" | "article" | "li";
}) {
  return (
    <Tag className={cn("clay p-5 sm:p-6", hover && "clay-hover", className)}>{children}</Tag>
  );
}

export function ClaySectionHeader({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
      <div>
        <h2 className="text-lg font-semibold text-foreground">{title}</h2>
        {description ? (
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {action}
    </div>
  );
}
