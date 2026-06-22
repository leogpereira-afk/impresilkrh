"use client";

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

const tooltipStyle = {
  borderRadius: 8,
  border: "1px solid #e2e8f0",
  fontSize: 12,
  boxShadow: "0 4px 12px -2px rgba(15,34,54,0.12)",
};

export function BarrasVerticais({
  data,
  cor = "#16334f",
  altura = 260,
}: {
  data: { nome: string; valor: number }[];
  cor?: string;
  altura?: number;
}) {
  return (
    <ResponsiveContainer width="100%" height={altura}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eef2f7" />
        <XAxis
          dataKey="nome"
          tick={{ fontSize: 11, fill: "#64748b" }}
          tickLine={false}
          axisLine={{ stroke: "#e2e8f0" }}
          interval={0}
          angle={data.length > 5 ? -20 : 0}
          textAnchor={data.length > 5 ? "end" : "middle"}
          height={data.length > 5 ? 60 : 30}
        />
        <YAxis tick={{ fontSize: 11, fill: "#64748b" }} tickLine={false} axisLine={false} allowDecimals={false} />
        <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "#f1f5f9" }} />
        <Bar dataKey="valor" fill={cor} radius={[6, 6, 0, 0]} maxBarSize={48} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function BarrasColoridas({
  data,
  altura = 260,
}: {
  data: { nome: string; valor: number; cor: string }[];
  altura?: number;
}) {
  return (
    <ResponsiveContainer width="100%" height={altura}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eef2f7" />
        <XAxis dataKey="nome" tick={{ fontSize: 11, fill: "#64748b" }} tickLine={false} axisLine={{ stroke: "#e2e8f0" }} />
        <YAxis tick={{ fontSize: 11, fill: "#64748b" }} tickLine={false} axisLine={false} allowDecimals={false} />
        <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "#f1f5f9" }} />
        <Bar dataKey="valor" radius={[6, 6, 0, 0]} maxBarSize={56}>
          {data.map((d, i) => (
            <Cell key={i} fill={d.cor} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

export function Rosca({
  data,
  altura = 260,
}: {
  data: { nome: string; valor: number; cor: string }[];
  altura?: number;
}) {
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
        >
          {data.map((d, i) => (
            <Cell key={i} fill={d.cor} />
          ))}
        </Pie>
        <Tooltip contentStyle={tooltipStyle} />
        <Legend
          verticalAlign="bottom"
          height={36}
          iconType="circle"
          formatter={(v) => <span style={{ fontSize: 12, color: "#475569" }}>{v}</span>}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}
