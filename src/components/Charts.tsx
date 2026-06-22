import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Cell, PieChart, Pie, Legend, CartesianGrid,
} from "recharts";

const tip = { borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 12 };

export function Barras({ data, cor = "#16334f", altura = 240 }: { data: { nome: string; valor: number }[]; cor?: string; altura?: number }) {
  return (
    <ResponsiveContainer width="100%" height={altura}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eef2f7" />
        <XAxis dataKey="nome" tick={{ fontSize: 11, fill: "#64748b" }} tickLine={false} axisLine={{ stroke: "#e2e8f0" }} interval={0} angle={data.length > 5 ? -20 : 0} textAnchor={data.length > 5 ? "end" : "middle"} height={data.length > 5 ? 60 : 30} />
        <YAxis tick={{ fontSize: 11, fill: "#64748b" }} tickLine={false} axisLine={false} allowDecimals={false} />
        <Tooltip contentStyle={tip} cursor={{ fill: "#f1f5f9" }} />
        <Bar dataKey="valor" fill={cor} radius={[6, 6, 0, 0]} maxBarSize={48} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function Rosca({ data, altura = 240 }: { data: { nome: string; valor: number; cor: string }[]; altura?: number }) {
  return (
    <ResponsiveContainer width="100%" height={altura}>
      <PieChart>
        <Pie data={data} dataKey="valor" nameKey="nome" cx="50%" cy="50%" innerRadius={54} outerRadius={84} paddingAngle={2}>
          {data.map((d, i) => <Cell key={i} fill={d.cor} />)}
        </Pie>
        <Tooltip contentStyle={tip} />
        <Legend verticalAlign="bottom" height={36} iconType="circle" formatter={(v) => <span style={{ fontSize: 12, color: "#475569" }}>{v}</span>} />
      </PieChart>
    </ResponsiveContainer>
  );
}
