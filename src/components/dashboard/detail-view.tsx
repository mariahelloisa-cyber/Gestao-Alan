import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";

/** Cabeçalho com ícone circular — substitui o DialogHeader padrão nos cards de detalhes. */
export function DetailHeader({
  icon: Icon,
  title,
  subtitle,
}: {
  icon: LucideIcon;
  title: string;
  subtitle: string;
}) {
  return (
    <DialogHeader className="flex-row items-center gap-4 space-y-0 text-left">
      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-indigo-600 dark:bg-indigo-950/50 dark:text-indigo-400">
        <Icon className="h-6 w-6" />
      </div>
      <div className="min-w-0">
        <DialogTitle className="text-xl">{title}</DialogTitle>
        <DialogDescription>{subtitle}</DialogDescription>
      </div>
    </DialogHeader>
  );
}

/** Caixa de destaque no topo do card — normalmente nível + nome. */
export function DetailHighlight({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-x-6 gap-y-3 rounded-lg border border-border bg-muted/50 p-4">
      {children}
    </div>
  );
}

export function DetailHighlightItem({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-w-0">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <div className="mt-1">{children}</div>
    </div>
  );
}

/** Bloco com título + ícone agrupando campos relacionados. */
export function DetailSection({
  icon: Icon,
  title,
  children,
  className,
}: {
  icon: LucideIcon;
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("rounded-lg border border-border p-4", className)}>
      <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-indigo-600 dark:text-indigo-400">
        <Icon className="h-4 w-4" />
        {title}
      </div>
      <div className="grid gap-x-4 gap-y-3 text-sm sm:grid-cols-2">{children}</div>
    </div>
  );
}

/** Um par ícone + rótulo + valor, usado dentro de um DetailSection. */
export function DetailField({
  icon: Icon,
  label,
  children,
  full,
}: {
  icon: LucideIcon;
  label: string;
  children: React.ReactNode;
  full?: boolean;
}) {
  return (
    <div className={cn("min-w-0 space-y-1", full && "sm:col-span-2")}>
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </div>
      <div className="break-words">{children}</div>
    </div>
  );
}
