import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Cell,
  PieChart,
  Pie,
  Legend,
  CartesianGrid,
} from "recharts";
import { useTemaEscuro } from "@/lib/tema";

const fmtBRLCompacto = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", notation: "compact", maximumFractionDigits: 1 }).format(v);
const fmtBRL = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(v);

// No tema escuro, cores muito escuras (ex.: navy #16334f) somem sobre o fundo.
// Clareia preservando a matiz (escala de brilho) quando a cor é escura.
function corGrafico(hex: string, escuro: boolean): string {
  if (!escuro) return hex;
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return hex;
  const n = parseInt(m[1], 16);
  let r = (n >> 16) & 255;
  let g = (n >> 8) & 255;
  let b = n & 255;
  const L = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  if (L >= 120) return hex; // já tem brilho suficiente
  const fator = Math.min(3.4, 150 / Math.max(L, 28));
  r = Math.min(255, Math.round(r * fator));
  g = Math.min(255, Math.round(g * fator));
  b = Math.min(255, Math.round(b * fator));
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, "0")}`;
}

// Paleta de eixos/grade/tooltip/legenda conforme o tema.
function useEstiloGrafico() {
  const escuro = useTemaEscuro();
  return {
    escuro,
    tick: escuro ? "#94a3b8" : "#64748b",
    grade: escuro ? "rgba(255,255,255,0.08)" : "#eef2f7",
    eixo: escuro ? "rgba(255,255,255,0.16)" : "#e2e8f0",
    cursor: escuro ? "rgba(255,255,255,0.07)" : "#f1f5f9",
    legenda: escuro ? "#cbd5e1" : "#475569",
    tooltip: {
      contentStyle: {
        borderRadius: 8,
        border: escuro ? "1px solid rgba(255,255,255,0.14)" : "1px solid #e2e8f0",
        background: escuro ? "#1b2536" : "#ffffff",
        fontSize: 12,
        boxShadow: escuro ? "0 8px 20px -6px rgba(0,0,0,0.6)" : "0 4px 12px -2px rgba(15,34,54,0.12)",
      },
      labelStyle: { color: escuro ? "#e8eef6" : "#0f2236" },
      itemStyle: { color: escuro ? "#cbd5e1" : "#475569" },
    },
  };
}

export function BarrasVerticais({
  data,
  cor = "#16334f",
  altura = 260,
  moeda = false,
  onItemClick,
}: {
  data: { nome: string; valor: number }[];
  cor?: string;
  altura?: number;
  moeda?: boolean;
  onItemClick?: (nome: string) => void;
}) {
  const t = useEstiloGrafico();
  return (
    <ResponsiveContainer width="100%" height={altura}>
      <BarChart
        data={data}
        margin={{ top: 8, right: 8, left: moeda ? 8 : -16, bottom: 0 }}
        onClick={onItemClick ? (e: { activeLabel?: string | number }) => e?.activeLabel != null && onItemClick(String(e.activeLabel)) : undefined}
        className={onItemClick ? "cursor-pointer" : undefined}
      >
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={t.grade} />
        <XAxis
          dataKey="nome"
          tick={{ fontSize: 11, fill: t.tick }}
          tickLine={false}
          axisLine={{ stroke: t.eixo }}
          interval={0}
          angle={data.length > 5 ? -20 : 0}
          textAnchor={data.length > 5 ? "end" : "middle"}
          height={data.length > 5 ? 60 : 30}
        />
        <YAxis
          tick={{ fontSize: 11, fill: t.tick }}
          tickLine={false}
          axisLine={false}
          allowDecimals={false}
          width={moeda ? 64 : undefined}
          tickFormatter={moeda ? (v) => fmtBRLCompacto(Number(v)) : undefined}
        />
        <Tooltip
          {...t.tooltip}
          cursor={{ fill: t.cursor }}
          formatter={moeda ? (v) => [fmtBRL(Number(v)), "Valor"] as [string, string] : undefined}
        />
        <Bar dataKey="valor" fill={corGrafico(cor, t.escuro)} radius={[6, 6, 0, 0]} maxBarSize={48} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function BarrasDuplas({
  data,
  serieA,
  serieB,
  altura = 260,
  onItemClick,
}: {
  data: { nome: string; a: number; b: number }[];
  serieA: { nome: string; cor: string };
  serieB: { nome: string; cor: string };
  altura?: number;
  onItemClick?: (nome: string) => void;
}) {
  const t = useEstiloGrafico();
  return (
    <ResponsiveContainer width="100%" height={altura}>
      <BarChart
        data={data}
        margin={{ top: 8, right: 8, left: -16, bottom: 0 }}
        onClick={onItemClick ? (e: { activeLabel?: string | number }) => e?.activeLabel != null && onItemClick(String(e.activeLabel)) : undefined}
        className={onItemClick ? "cursor-pointer" : undefined}
      >
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={t.grade} />
        <XAxis dataKey="nome" tick={{ fontSize: 11, fill: t.tick }} tickLine={false} axisLine={{ stroke: t.eixo }} />
        <YAxis tick={{ fontSize: 11, fill: t.tick }} tickLine={false} axisLine={false} allowDecimals={false} />
        <Tooltip {...t.tooltip} cursor={{ fill: t.cursor }} />
        <Legend iconType="circle" formatter={(v) => <span style={{ fontSize: 12, color: t.legenda }}>{v}</span>} />
        <Bar dataKey="a" name={serieA.nome} fill={corGrafico(serieA.cor, t.escuro)} radius={[4, 4, 0, 0]} maxBarSize={28} />
        <Bar dataKey="b" name={serieB.nome} fill={corGrafico(serieB.cor, t.escuro)} radius={[4, 4, 0, 0]} maxBarSize={28} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function BarrasColoridas({
  data,
  altura = 260,
  onItemClick,
}: {
  data: { nome: string; valor: number; cor: string }[];
  altura?: number;
  onItemClick?: (nome: string) => void;
}) {
  const t = useEstiloGrafico();
  return (
    <ResponsiveContainer width="100%" height={altura}>
      <BarChart
        data={data}
        margin={{ top: 8, right: 8, left: -16, bottom: 0 }}
        onClick={onItemClick ? (e: { activeLabel?: string | number }) => e?.activeLabel != null && onItemClick(String(e.activeLabel)) : undefined}
        className={onItemClick ? "cursor-pointer" : undefined}
      >
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={t.grade} />
        <XAxis dataKey="nome" tick={{ fontSize: 11, fill: t.tick }} tickLine={false} axisLine={{ stroke: t.eixo }} />
        <YAxis tick={{ fontSize: 11, fill: t.tick }} tickLine={false} axisLine={false} allowDecimals={false} />
        <Tooltip {...t.tooltip} cursor={{ fill: t.cursor }} />
        <Bar dataKey="valor" radius={[6, 6, 0, 0]} maxBarSize={56}>
          {data.map((d, i) => (
            <Cell key={i} fill={corGrafico(d.cor, t.escuro)} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

export function Rosca({
  data,
  altura = 260,
  onItemClick,
}: {
  data: { nome: string; valor: number; cor: string }[];
  altura?: number;
  onItemClick?: (nome: string) => void;
}) {
  const t = useEstiloGrafico();
  return (
    <ResponsiveContainer width="100%" height={altura}>
      <PieChart>
        <Pie
          data={data}
          dataKey="valor"
          nameKey="nome"
          cx="50%"
          cy="50%"
          innerRadius={58}
          outerRadius={88}
          paddingAngle={2}
          onClick={onItemClick ? (d: { nome?: string }) => d?.nome && onItemClick(d.nome) : undefined}
          className={onItemClick ? "cursor-pointer" : undefined}
        >
          {data.map((d, i) => (
            <Cell key={i} fill={corGrafico(d.cor, t.escuro)} stroke={t.escuro ? "#151e2e" : "#ffffff"} />
          ))}
        </Pie>
        <Tooltip {...t.tooltip} />
        <Legend verticalAlign="bottom" height={36} iconType="circle" formatter={(v) => <span style={{ fontSize: 12, color: t.legenda }}>{v}</span>} />
      </PieChart>
    </ResponsiveContainer>
  );
}
