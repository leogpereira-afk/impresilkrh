"use client";

import { useState, useMemo } from "react";
import { Card, CardHeader, CardBody } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatBRL } from "@/lib/format";
import { Calculator, ArrowRight, TrendingUp } from "lucide-react";

interface CargoSim {
  id: string;
  nome: string;
  trilha: string | null;
  faixas: { codigo: string; senioridade: string; ordem: number; valor: number }[];
}

export function SimuladorProgressao({
  cargos,
  cargoInicialId,
  nivelInicialCodigo,
}: {
  cargos: CargoSim[];
  cargoInicialId?: string;
  nivelInicialCodigo?: string;
}) {
  const [cargoId, setCargoId] = useState(cargoInicialId ?? cargos[0]?.id ?? "");
  const cargo = cargos.find((c) => c.id === cargoId);
  const faixas = cargo?.faixas ?? [];

  const [origem, setOrigem] = useState(nivelInicialCodigo ?? faixas[0]?.codigo ?? "N1");
  const idxOrigem = faixas.findIndex((f) => f.codigo === origem);
  const [destino, setDestino] = useState(
    faixas[Math.min(idxOrigem + 1, faixas.length - 1)]?.codigo ?? origem,
  );

  const fOrigem = faixas.find((f) => f.codigo === origem);
  const fDestino = faixas.find((f) => f.codigo === destino);

  const resultado = useMemo(() => {
    if (!fOrigem || !fDestino) return null;
    const delta = fDestino.valor - fOrigem.valor;
    const pct = fOrigem.valor > 0 ? (delta / fOrigem.valor) * 100 : 0;
    return { delta, pct };
  }, [fOrigem, fDestino]);

  return (
    <Card>
      <CardHeader
        title="Simulador de progressão"
        subtitle="Projete o impacto salarial de uma promoção"
        icon={<Calculator className="h-4 w-4" />}
      />
      <CardBody className="space-y-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div>
            <label className="label">Cargo</label>
            <select
              className="input"
              value={cargoId}
              onChange={(e) => {
                setCargoId(e.target.value);
                const novo = cargos.find((c) => c.id === e.target.value);
                const fs = novo?.faixas ?? [];
                setOrigem(fs[0]?.codigo ?? "N1");
                setDestino(fs[1]?.codigo ?? fs[0]?.codigo ?? "N1");
              }}
            >
              {cargos.map((c) => (
                <option key={c.id} value={c.id}>{c.nome}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Nível atual</label>
            <select className="input" value={origem} onChange={(e) => setOrigem(e.target.value)}>
              {faixas.map((f) => (
                <option key={f.codigo} value={f.codigo}>{f.codigo} · {f.senioridade}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Nível desejado</label>
            <select className="input" value={destino} onChange={(e) => setDestino(e.target.value)}>
              {faixas.map((f) => (
                <option key={f.codigo} value={f.codigo}>{f.codigo} · {f.senioridade}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex items-center justify-center gap-4 rounded-xl bg-slate-50 p-5">
          <div className="text-center">
            <p className="text-xs uppercase tracking-wide text-slate-400">{fOrigem?.codigo}</p>
            <p className="text-lg font-semibold text-slate-700">{formatBRL(fOrigem?.valor)}</p>
          </div>
          <ArrowRight className="h-5 w-5 text-slate-300" />
          <div className="text-center">
            <p className="text-xs uppercase tracking-wide text-gold-600">{fDestino?.codigo}</p>
            <p className="text-lg font-semibold text-brand-ink">{formatBRL(fDestino?.valor)}</p>
          </div>
        </div>

        {resultado && (
          <div className="flex items-center justify-between rounded-xl bg-brand-ink px-5 py-4 text-white">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-gold-200" />
              <span className="text-sm text-slate-200">Variação salarial</span>
            </div>
            <div className="text-right">
              <p className="text-lg font-semibold">
                {resultado.delta >= 0 ? "+" : ""}{formatBRL(resultado.delta)}
              </p>
              <Badge variant="gold">
                {resultado.pct >= 0 ? "+" : ""}{resultado.pct.toFixed(1)}%
              </Badge>
            </div>
          </div>
        )}
      </CardBody>
    </Card>
  );
}
