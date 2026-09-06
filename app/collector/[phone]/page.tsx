"use client"

import * as React from "react"
import { useEffect, useState, useCallback } from "react"
import { useParams } from "next/navigation"
import Link from "next/link"
import { supabase, type IntakeTransaction, type MaterialCode } from "@/lib/supabase"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  User,
  Phone,
  Scale,
  Coins,
  Award,
  CheckCircle2,
  Clock,
  ArrowLeft,
  ShieldCheck,
  Loader2,
  AlertCircle,
  Recycle,
  Zap,
  TrendingUp,
  ExternalLink,
} from "lucide-react"

interface CollectorRow {
  phone: string
  name: string
  dbt_eligible: boolean
  created_at: string
}

interface EnrichedTransaction extends IntakeTransaction {
  payout: number
}

const MATERIAL_META: Record<MaterialCode, { label: string; symbol: string; color: string; badgeBg: string; icon: React.ElementType }> = {
  COPPER:   { label: "Copper",    symbol: "Cu",  color: "#d97706", badgeBg: "bg-amber-100 text-amber-900 border-amber-300",   icon: Zap },
  ALUMINUM: { label: "Aluminum",  symbol: "Al",  color: "#64748b", badgeBg: "bg-slate-100 text-slate-800 border-slate-300",   icon: Recycle },
  EWASTE:   { label: "E-Waste",   symbol: "PCB", color: "#059669", badgeBg: "bg-green-100 text-green-900 border-green-300", icon: Scale },
}

const DBT_THRESHOLD_KG = 20

function maskPhone(p: string): string {
  if (p.length <= 4) return p
  return "••••••" + p.slice(-4)
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
  } catch {
    return iso
  }
}

export default function CollectorDigitalIdPage() {
  const params = useParams()
  const phone = (params?.phone as string) || ""

  const [collector, setCollector] = useState<CollectorRow | null>(null)
  const [transactions, setTransactions] = useState<EnrichedTransaction[]>([])
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  const fetchData = useCallback(async () => {
    if (!phone) return
    setLoading(true)
    setNotFound(false)

    const [collRes, ratesRes, txRes] = await Promise.all([
      supabase.from("collectors").select("*").eq("phone", phone).maybeSingle(),
      supabase.from("material_rates").select("material_code, rate_per_kg"),
      supabase
        .from("intake_transactions")
        .select("*")
        .eq("collector_phone", phone)
        .order("timestamp", { ascending: false }),
    ])

    if (collRes.error || !collRes.data) {
      setNotFound(true)
      setLoading(false)
      return
    }

    setCollector(collRes.data as CollectorRow)

    const rateMap: Record<string, number> = {
      COPPER: 500,
      ALUMINUM: 150,
      EWASTE: 50,
    }
    if (ratesRes.data) {
      ratesRes.data.forEach((r: { material_code: string; rate_per_kg: number }) => {
        rateMap[r.material_code] = Number(r.rate_per_kg)
      })
    }

    const txs: EnrichedTransaction[] = (txRes.data || []).map((t: IntakeTransaction) => ({
      ...t,
      payout: Math.round(Number(t.weight_kg) * (rateMap[t.material_code] ?? 0)),
    }))

    setTransactions(txs)
    setLoading(false)
  }, [phone])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // Derived stats
  const totalWeightKg = transactions.reduce((s, t) => s + Number(t.weight_kg), 0)
  const totalPayout   = transactions.reduce((s, t) => s + t.payout, 0)
  const isDbtEligible = totalWeightKg >= DBT_THRESHOLD_KG
  const progressPct   = Math.min(100, Math.round((totalWeightKg / DBT_THRESHOLD_KG) * 100))
  const remainingKg   = Math.max(0, parseFloat((DBT_THRESHOLD_KG - totalWeightKg).toFixed(2)))

  const byMaterial = (["COPPER", "ALUMINUM", "EWASTE"] as MaterialCode[]).map((code) => ({
    code,
    kg: transactions.filter((t) => t.material_code === code).reduce((s, t) => s + Number(t.weight_kg), 0),
  }))

  // ── Loading / Not Found states ─────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen bg-stone-50 flex flex-col items-center justify-center gap-4 text-stone-500">
        <Loader2 className="h-10 w-10 animate-spin text-green-700" />
        <p className="text-sm font-mono uppercase tracking-widest">Loading Digital ID…</p>
      </div>
    )
  }

  if (notFound) {
    return (
      <div className="min-h-screen bg-stone-50 flex flex-col items-center justify-center gap-5 text-stone-500 px-4">
        <AlertCircle className="h-12 w-12 text-rose-500" />
        <div className="text-center">
          <h1 className="text-xl font-bold text-stone-900 mb-1">Collector Not Found</h1>
          <p className="text-sm text-stone-600">
            No registered Kabadiwala found for phone ending in <span className="font-mono text-stone-900 font-bold">…{phone.slice(-4)}</span>.
          </p>
          <p className="text-xs text-stone-500 mt-1">They may need to be registered first at an Aggregator POS terminal.</p>
        </div>
        <Link href="/">
          <Button variant="outline" size="sm" className="border-stone-300 hover:bg-stone-100 text-stone-700 gap-1.5">
            <ArrowLeft className="h-3.5 w-3.5" /> Back to Hub
          </Button>
        </Link>
      </div>
    )
  }

  // ── Main render ────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-stone-50 text-stone-900 flex flex-col font-sans">

      {/* Header */}
      <header className="border-b border-stone-200 bg-white/95 backdrop-blur sticky top-0 z-30 px-4 py-3 sm:px-8">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-green-50 border border-green-200 text-green-700">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <div className="text-[10px] font-mono font-bold tracking-widest text-green-800 uppercase">
                GOVERNMENT OF INDIA • MINISTRY OF MINES
              </div>
              <div className="text-sm font-bold text-stone-900 leading-tight">Dhatu Setu — Digital ID</div>
            </div>
          </div>

          <Link href="/">
            <Button variant="outline" size="sm"
              className="h-7 px-2.5 text-xs border-stone-300 hover:bg-stone-100 text-stone-700 gap-1.5">
              <ArrowLeft className="h-3 w-3" />
              Hub
            </Button>
          </Link>
        </div>
      </header>

      <main className="flex-1 max-w-3xl w-full mx-auto p-4 sm:p-6 lg:p-8 space-y-6">

        {/* ── Identity Hero Card ─────────────────────────────────────────── */}
        <Card className="border-stone-200 bg-white shadow-md relative overflow-hidden">
          {/* Decorative gradient strip */}
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-green-600 via-emerald-500 to-blue-600" />

          {/* Faint watermark */}
          <div className="absolute right-4 bottom-4 opacity-5 pointer-events-none">
            <ShieldCheck className="h-40 w-40 text-green-700" />
          </div>

          <CardContent className="p-5 sm:p-7">
            <div className="flex flex-col sm:flex-row sm:items-start gap-5">
              {/* Avatar placeholder */}
              <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-green-50 border border-green-200 text-green-700">
                <User className="h-9 w-9" />
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2 mb-1">
                  <h1 className="text-xl sm:text-2xl font-black text-stone-900 tracking-tight">
                    {collector!.name}
                  </h1>
                  {isDbtEligible ? (
                    <Badge className="bg-green-100 text-green-900 border border-green-300 gap-1 text-xs font-semibold">
                      <CheckCircle2 className="h-3 w-3 text-green-700" /> DBT Eligible
                    </Badge>
                  ) : (
                    <Badge className="bg-stone-100 text-stone-700 border border-stone-300 gap-1 text-xs">
                      <Clock className="h-3 w-3 text-stone-500" /> DBT In Progress
                    </Badge>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-3 text-sm text-stone-500 font-mono">
                  <span className="flex items-center gap-1.5">
                    <Phone className="h-3.5 w-3.5 text-stone-400" />
                    🇮🇳 +91 {maskPhone(phone)}
                  </span>
                  <span className="text-stone-300">•</span>
                  <span className="flex items-center gap-1.5">
                    <Clock className="h-3.5 w-3.5 text-stone-400" />
                    Since {new Date(collector!.created_at).toLocaleDateString("en-IN", { month: "short", year: "numeric" })}
                  </span>
                </div>

                {/* QR-style ID chip */}
                <div className="mt-3 inline-flex items-center gap-2 bg-stone-100 border border-stone-200 rounded-lg px-3 py-1.5">
                  <span className="text-[10px] font-mono text-stone-500 uppercase tracking-widest">Collector ID</span>
                  <span className="text-xs font-black font-mono text-stone-900">KBDW-{phone.slice(-6)}</span>
                </div>
              </div>
            </div>

            {/* DBT Progress Bar */}
            {!isDbtEligible && (
              <div className="mt-5 pt-4 border-t border-stone-200">
                <div className="flex items-center justify-between text-xs text-stone-600 mb-2">
                  <span className="flex items-center gap-1.5">
                    <Award className="h-3.5 w-3.5 text-amber-600" />
                    Progress to DBT Bonus (₹500 Government Benefit)
                  </span>
                  <span className="font-mono text-stone-900 font-bold">
                    {totalWeightKg.toFixed(1)} / {DBT_THRESHOLD_KG} kg
                  </span>
                </div>
                <div className="w-full bg-stone-200 rounded-full h-2.5 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-green-600 transition-all duration-500"
                    style={{ width: `${progressPct}%` }}
                  />
                </div>
                <div className="flex items-center justify-between text-[11px] text-stone-500 mt-1.5">
                  <span>{progressPct}% achieved</span>
                  <span className="text-amber-800 font-mono font-semibold">{remainingKg} kg remaining</span>
                </div>
              </div>
            )}

            {isDbtEligible && (
              <div className="mt-5 pt-4 border-t border-stone-200">
                <div className="flex items-center gap-3 p-3 rounded-xl bg-green-50 border border-green-200">
                  <CheckCircle2 className="h-5 w-5 text-green-700 shrink-0" />
                  <div>
                    <div className="text-sm font-bold text-green-900">DBT Bonus Unlocked!</div>
                    <div className="text-xs text-green-800">
                      {totalWeightKg.toFixed(1)} kg verified — eligible for ₹500 Ministry of Mines Direct Benefit Transfer.
                    </div>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* ── KPI Summary Row ────────────────────────────────────────────── */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {/* Total Weight */}
          <Card className="border-stone-200 bg-white shadow-sm relative overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-1 bg-green-600" />
            <CardContent className="p-4">
              <div className="text-[10px] font-bold uppercase tracking-wider text-green-800 mb-1 flex items-center gap-1.5">
                <Scale className="h-3 w-3 text-green-700" /> Lifetime Weight
              </div>
              <div className="text-3xl font-black font-mono text-stone-900">
                {totalWeightKg.toLocaleString("en-IN", { minimumFractionDigits: 1, maximumFractionDigits: 2 })}
                <span className="text-base font-semibold text-green-700 ml-1">kg</span>
              </div>
              <div className="text-[11px] text-stone-500 mt-1">{transactions.length} verified intake{transactions.length !== 1 ? "s" : ""}</div>
            </CardContent>
          </Card>

          {/* Total Payout */}
          <Card className="border-stone-200 bg-white shadow-sm relative overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-1 bg-amber-600" />
            <CardContent className="p-4">
              <div className="text-[10px] font-bold uppercase tracking-wider text-amber-800 mb-1 flex items-center gap-1.5">
                <Coins className="h-3 w-3 text-amber-600" /> Lifetime Payout
              </div>
              <div className="text-3xl font-black font-mono text-stone-900">
                ₹{totalPayout.toLocaleString("en-IN")}
              </div>
              <div className="text-[11px] text-stone-500 mt-1">At current MoM rates</div>
            </CardContent>
          </Card>

          {/* DBT Status */}
          <Card className="border-stone-200 bg-white shadow-sm relative overflow-hidden">
            <div className={`absolute top-0 left-0 right-0 h-1 ${isDbtEligible ? "bg-green-600" : "bg-blue-600"}`} />
            <CardContent className="p-4">
              <div className="text-[10px] font-bold uppercase tracking-wider text-blue-800 mb-1 flex items-center gap-1.5">
                <Award className="h-3 w-3 text-blue-600" /> DBT Status
              </div>
              <div className={`text-lg font-black ${isDbtEligible ? "text-green-700" : "text-stone-700"}`}>
                {isDbtEligible ? "✓ Qualified" : `${progressPct}% Done`}
              </div>
              <div className="text-[11px] text-stone-500 mt-1">
                {isDbtEligible ? "₹500 bonus pending disbursal" : `${remainingKg} kg to ₹500 bonus`}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* ── By Material Breakdown ──────────────────────────────────────── */}
        <Card className="border-stone-200 bg-white shadow-sm">
          <CardHeader className="border-b border-stone-100 pb-3">
            <CardTitle className="text-sm font-bold text-stone-900 flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-green-700" />
              Collection by Material
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-stone-100">
              {byMaterial.map(({ code, kg }) => {
                const meta = MATERIAL_META[code]
                const Icon = meta.icon
                const pct = totalWeightKg > 0 ? Math.round((kg / totalWeightKg) * 100) : 0
                return (
                  <div key={code} className="flex items-center gap-4 px-5 py-3.5">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
                      style={{ background: `${meta.color}15`, border: `1px solid ${meta.color}30` }}>
                      <Icon className="h-4 w-4" style={{ color: meta.color }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between text-sm mb-1">
                        <span className="font-semibold text-stone-900">{meta.label}</span>
                        <span className="font-mono text-stone-700 text-xs font-bold">{kg.toFixed(2)} kg</span>
                      </div>
                      <div className="w-full bg-stone-100 rounded-full h-1.5 overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{ width: `${pct}%`, backgroundColor: meta.color }}
                        />
                      </div>
                    </div>
                    <span className="text-xs font-mono text-stone-500 shrink-0 w-8 text-right">{pct}%</span>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>

        {/* ── Transaction History Table ──────────────────────────────────── */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold uppercase tracking-wider text-stone-700 flex items-center gap-2">
              <Clock className="h-4 w-4 text-green-700" />
              Verified Intake History
            </h2>
            <span className="text-xs text-stone-500 font-mono">{transactions.length} record{transactions.length !== 1 ? "s" : ""}</span>
          </div>

          <Card className="border-stone-200 bg-white shadow-sm overflow-hidden">
            {transactions.length === 0 ? (
              <div className="py-14 flex flex-col items-center gap-3 text-stone-400">
                <Scale className="h-8 w-8" />
                <p className="text-sm">No intake records yet.</p>
              </div>
            ) : (
              <Table>
                <TableHeader className="bg-stone-50 border-b border-stone-200">
                  <TableRow className="border-stone-200 hover:bg-transparent">
                    <TableHead className="font-bold text-stone-700 text-xs">Date & Time</TableHead>
                    <TableHead className="font-bold text-stone-700 text-xs">Material</TableHead>
                    <TableHead className="font-bold text-stone-700 text-xs text-right">Weight</TableHead>
                    <TableHead className="font-bold text-stone-700 text-xs text-right">Payout</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {transactions.map((tx, i) => {
                    const meta = MATERIAL_META[tx.material_code]
                    return (
                      <TableRow
                        key={tx.id}
                        className={`border-stone-100 hover:bg-stone-50/80 transition-colors ${i === 0 ? "bg-green-50/40" : ""}`}
                      >
                        <TableCell className="text-xs text-stone-600 font-mono">
                          {i === 0 && (
                            <span className="inline-block mr-1.5 text-[9px] font-bold bg-green-100 text-green-800 border border-green-200 px-1.5 py-0.5 rounded-full uppercase tracking-wider">
                              Latest
                            </span>
                          )}
                          {formatDate(tx.timestamp)}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={`text-[10px] font-bold gap-1 ${meta.badgeBg}`}>
                            {meta.symbol} {meta.label}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right font-mono text-sm text-stone-900 font-semibold">
                          {Number(tx.weight_kg).toFixed(2)}
                          <span className="text-xs text-stone-500 ml-1">kg</span>
                        </TableCell>
                        <TableCell className="text-right font-mono text-sm font-bold text-green-700">
                          ₹{tx.payout.toLocaleString("en-IN")}
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            )}
          </Card>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-stone-200 bg-white px-4 py-4 mt-auto">
        <div className="max-w-3xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-stone-500">
          <span>
            Ministry of Mines (MoM) • Critical Mineral Traceability Network (CMTN) • Dhatu Setu
          </span>
          <span className="flex items-center gap-1.5 text-stone-600">
            <ExternalLink className="h-3 w-3" />
            Verified digital receipt — blockchain-ready
          </span>
        </div>
      </footer>
    </div>
  )
}
