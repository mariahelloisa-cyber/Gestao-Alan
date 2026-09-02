import {
  Eye,
  Pencil,
  Trash2,
  CircleCheck,
  CircleX,
  ExternalLink,
  User,
  GraduationCap,
  Wallet,
  Clock,
} from "lucide-react";
import type { Polo } from "@/lib/polos.functions";
import {
  NIVEL_COR,
  formatarData,
  formatarHorario,
  formatarValor,
  nivelBadgeStyle,
  rotuloRelativo,
  statusReuniao,
  type Nivel,
} from "@/lib/polos-ui";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";

/** Campo secundário: rótulo discreto em cima, valor legível embaixo. */
function Campo({
  icone: Icone,
  label,
  valor,
  sub,
}: {
  icone: typeof User;
  label: string;
  valor: string;
  sub?: string | null;
}) {
  return (
    <div className="min-w-0">
      <p className="flex items-center gap-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        <Icone className="h-3 w-3 shrink-0" />
        {label}
      </p>
      <p className="truncate text-sm text-foreground" title={valor}>
        {valor}
      </p>
      {sub && (
        <p className="truncate text-xs text-muted-foreground" title={sub}>
          {sub}
        </p>
      )}
    </div>
  );
}

function AcaoIcone({
  label,
  onClick,
  className,
  children,
}: {
  label: string;
  onClick: () => void;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          size="icon"
          variant="ghost"
          onClick={onClick}
          aria-label={label}
          className={cn("h-8 w-8 text-muted-foreground hover:text-foreground", className)}
        >
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

export function ReuniaoListItem({
  polo,
  onVisualizar,
  onEditar,
  onFechou,
  onNaoFechou,
  onExcluir,
}: {
  polo: Polo;
  onVisualizar: () => void;
  onEditar: () => void;
  onFechou: () => void;
  onNaoFechou: () => void;
  onExcluir: () => void;
}) {
  const nivel = polo.nivel as Nivel;
  const cor = NIVEL_COR[nivel];
  const status = statusReuniao(polo.data_reuniao);
  const atrasada = status.id === "atrasada";

  return (
    <div
      className={cn(
        "group relative border-b border-border transition-colors last:border-b-0 hover:bg-accent/40",
        // Atrasada: tinta vermelha bem suave, sem gritar.
        atrasada && "bg-red-50/50 hover:bg-red-50 dark:bg-red-950/15 dark:hover:bg-red-950/25",
      )}
    >
      {/* Faixa da cor do nível — identidade visual compartilhada com a Agenda. */}
      <span
        aria-hidden
        className="absolute inset-y-0 left-0 w-[3px]"
        style={{ backgroundColor: cor }}
      />

      <div className="flex flex-col gap-3 py-3.5 pl-5 pr-4 lg:flex-row lg:items-center lg:gap-4">
        {/* Identificação + campos */}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Badge style={nivelBadgeStyle(nivel)} className="shrink-0 text-[10px]">
              {polo.nivel}
            </Badge>
            <h3 className="truncate text-[15px] font-semibold text-foreground" title={polo.nome}>
              {polo.nome}
            </h3>
            <span
              className={cn(
                "inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-medium",
                status.badge,
              )}
            >
              <span className={cn("h-1.5 w-1.5 rounded-full", status.ponto)} />
              {status.label}
            </span>
          </div>

          <div className="mt-2.5 grid gap-x-6 gap-y-2.5 sm:grid-cols-2 xl:grid-cols-3">
            <Campo icone={User} label="Contato" valor={polo.contato || "—"} sub={polo.email} />
            <Campo icone={GraduationCap} label="Produto" valor={polo.produto || "—"} />
            <Campo icone={Wallet} label="Faturamento" valor={formatarValor(polo.faturamento)} />
          </div>
        </div>

        {/* Quando + link + ações */}
        <div className="flex shrink-0 items-end justify-between gap-4 lg:w-72 lg:flex-col lg:items-end lg:justify-center">
          <div className="lg:text-right">
            <p className="text-sm font-semibold text-foreground">
              {rotuloRelativo(polo.data_reuniao)}
            </p>
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground lg:justify-end">
              <Clock className="h-3 w-3 shrink-0" />
              {formatarData(polo.data_reuniao)}
              {polo.horario_reuniao && ` · ${formatarHorario(polo.horario_reuniao)}`}
            </p>
            {polo.link_reuniao && (
              <a
                href={polo.link_reuniao}
                target="_blank"
                rel="noreferrer noopener"
                className="mt-1 inline-flex items-center gap-1 text-xs font-medium underline underline-offset-2 hover:opacity-80"
                style={{ color: cor }}
                title={polo.link_reuniao}
              >
                Abrir reunião <ExternalLink className="h-3 w-3" />
              </a>
            )}
          </div>

          <div className="flex items-center gap-0.5">
            <AcaoIcone label="Visualizar" onClick={onVisualizar}>
              <Eye className="h-4 w-4" />
            </AcaoIcone>
            <AcaoIcone label="Editar" onClick={onEditar}>
              <Pencil className="h-4 w-4" />
            </AcaoIcone>
            <AcaoIcone
              label="Fechou — mover para Ativação"
              onClick={onFechou}
              className="text-emerald-600 hover:text-emerald-700 dark:text-emerald-500"
            >
              <CircleCheck className="h-4 w-4" />
            </AcaoIcone>
            <AcaoIcone
              label="Não fechou — mover para Inativos"
              onClick={onNaoFechou}
              className="text-amber-600 hover:text-amber-700 dark:text-amber-500"
            >
              <CircleX className="h-4 w-4" />
            </AcaoIcone>

            <AlertDialog>
              <Tooltip>
                <TooltipTrigger asChild>
                  <AlertDialogTrigger asChild>
                    <Button
                      size="icon"
                      variant="ghost"
                      aria-label="Excluir"
                      className="h-8 w-8 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </AlertDialogTrigger>
                </TooltipTrigger>
                <TooltipContent>Excluir</TooltipContent>
              </Tooltip>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Excluir "{polo.nome}"?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Ação permanente. Os dados da reunião serão perdidos.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={onExcluir}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    Excluir
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
      </div>
    </div>
  );
}
