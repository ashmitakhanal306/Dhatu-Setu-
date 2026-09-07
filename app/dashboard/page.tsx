"use client"

import * as React from "react"
import { useState, useEffect, useCallback } from "react"
import Link from "next/link"
import { supabase, type IntakeTransaction } from "@/lib/supabase"
import { toast } from "@/components/ui/toast"
import { Input } from "@/components/ui/input"
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
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts"
import {
  ShieldCheck,
  Scale,
  RefreshCw,
  Coins,
  ArrowUpRight,
  Building2,
  AlertCircle,
  Clock,
  Layers,
  CheckCircle2,
  Activity,
  Award,
  TrendingUp,
  Save,
  Pencil,
  MapPin,
} from "lucide-react"

interface CollectorDBTSummary {
  phone: string
  totalWeight: number
  transactionCount: number
  isEligible: boolean
  remainingKg: number
}

interface FacilityMapData {
  id: string
  name: string
  location: string
  type: "Aggregator" | "Formal Recycler"
  latitude: number
  longitude: number
  volumeKg: number
}

interface CustomTooltipProps {
  active?: boolean
  payload?: Array<{
    value: number
    payload: {
      material: string
      weight: number
      color: string
      rate: number
    }
  }>
}

function CustomBarTooltip({ active, payload }: CustomTooltipProps) {
  if (active && payload && payload.length) {
    const data = payload[0].payload
    return (
      <div className="rounded-lg border border-stone-200 bg-white p-3 shadow-md">
        <div className="flex items-center gap-2 text-xs font-semibold text-stone-700">
          <span
            className="h-2.5 w-2.5 rounded-full"
            style={{ backgroundColor: data.color }}
          />
          <span>{data.material}</span>
        </div>
        <div className="mt-1 text-lg font-black font-mono text-stone-900">
          {data.weight.toLocaleString("en-IN", { minimumFractionDigits: 1 })} kg
        </div>
        <div className="text-[11px] text-stone-500 mt-0.5">
          Benchmark Rate: ₹{data.rate}/kg
        </div>
      </div>
    )
  }
  return null
}

export default function MoMDashboardPage() {
  const [transactions, setTransactions] = useState<IntakeTransaction[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lastUpdated, setLastUpdated] = useState<string>("")

  // Material rates state
  interface MaterialRate { material_code: string; rate_per_kg: number; updated_at: string }
  const [rates, setRates] = useState<MaterialRate[]>([])
  const [editRates, setEditRates] = useState<Record<string, string>>({})
  const [savingRate, setSavingRate] = useState<string | null>(null)
  const [facilityMap, setFacilityMap] = useState<FacilityMapData[]>([])
  const [mapTooltip, setMapTooltip] = useState<{ facility: FacilityMapData; x: number; y: number } | null>(null)

  const fetchTransactions = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)

      const { data, error: fetchError } = await supabase
        .from("intake_transactions")
        .select("*")
        .order("timestamp", { ascending: false })

      if (fetchError) {
        throw fetchError
      }

      setTransactions((data as IntakeTransaction[]) || [])
      setLastUpdated(
        new Date().toLocaleTimeString("en-IN", {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        })
      )
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to load live intake records"
      setError(msg)
    } finally {
      setLoading(false)
    }
  }, [])

  const fetchRates = useCallback(async () => {
    const { data } = await supabase
      .from("material_rates")
      .select("material_code, rate_per_kg, updated_at")
      .order("material_code")
    if (data) {
      setRates(data as MaterialRate[])
      const map: Record<string, string> = {}
      ;(data as MaterialRate[]).forEach((r) => {
        map[r.material_code] = String(r.rate_per_kg)
      })
      setEditRates(map)
    }
  }, [])

  const fetchFacilityMap = useCallback(async () => {
    // Fetch facilities with coordinates
    const { data: facs } = await supabase
      .from("facilities")
      .select("id, name, location, type, latitude, longitude")
    if (!facs) return

    // Aggregator volume = sum of their intake_transactions
    const { data: intakes } = await supabase
      .from("intake_transactions")
      .select("aggregator_id, weight_kg")

    // Recycler volume = sum of ACCEPTED dispatches
    const { data: dispatches } = await supabase
      .from("dispatches")
      .select("recycler_id, weight_kg, status")

    const aggVolume: Record<string, number> = {}
    ;(intakes || []).forEach((t: { aggregator_id: string; weight_kg: number }) => {
      aggVolume[t.aggregator_id] = (aggVolume[t.aggregator_id] ?? 0) + Number(t.weight_kg)
    })

    const recVolume: Record<string, number> = {}
    ;(dispatches || []).forEach((d: { recycler_id: string; weight_kg: number; status: string }) => {
      if (d.status === "ACCEPTED") {
        recVolume[d.recycler_id] = (recVolume[d.recycler_id] ?? 0) + Number(d.weight_kg)
      }
    })

    const mapped: FacilityMapData[] = (facs as Array<{
      id: string; name: string; location: string; type: string; latitude: number | null; longitude: number | null
    }>)
      .filter((f) => f.latitude != null && f.longitude != null)
      .map((f) => ({
        id: f.id,
        name: f.name,
        location: f.location,
        type: f.type as "Aggregator" | "Formal Recycler",
        latitude: Number(f.latitude),
        longitude: Number(f.longitude),
        volumeKg: f.type === "Aggregator"
          ? (aggVolume[f.id] ?? 0)
          : (recVolume[f.id] ?? 0),
      }))
    setFacilityMap(mapped)
  }, [])

  const saveRate = async (code: string) => {
    const newRate = parseFloat(editRates[code])
    if (isNaN(newRate) || newRate <= 0) {
      toast({ title: "Invalid Rate", description: "Please enter a positive number.", type: "error" })
      return
    }
    setSavingRate(code)
    const { error: saveErr } = await supabase
      .from("material_rates")
      .update({ rate_per_kg: newRate, updated_at: new Date().toISOString() })
      .eq("material_code", code)
    setSavingRate(null)
    if (saveErr) {
      toast({ title: "Save Failed", description: saveErr.message, type: "error" })
    } else {
      toast({
        title: "Rate Updated ✔️",
        description: `${code} rate set to ₹${newRate}/kg. POS terminals updated instantly.`,
        type: "success",
      })
      fetchRates()
    }
  }

  useEffect(() => {
    fetchTransactions()
    fetchRates()
    fetchFacilityMap()

    // Realtime subscription: updates immediately when new intake is logged from POS
    const channel = supabase
      .channel("realtime-dashboard-intake")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "intake_transactions" },
        () => {
          fetchTransactions()
          fetchFacilityMap()
        }
      )
      .subscribe()

    const ratesChannel = supabase
      .channel("realtime-dashboard-rates")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "material_rates" },
        () => {
          fetchRates()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
      supabase.removeChannel(ratesChannel)
    }
  }, [fetchTransactions, fetchRates, fetchFacilityMap])

  // Real-time KPI Calculations
  const copperWeight = transactions
    .filter((t) => t.material_code === "COPPER")
    .reduce((sum, t) => sum + Number(t.weight_kg), 0)

  const ewasteWeight = transactions
    .filter((t) => t.material_code === "EWASTE")
    .reduce((sum, t) => sum + Number(t.weight_kg), 0)

  const aluminumWeight = transactions
    .filter((t) => t.material_code === "ALUMINUM")
    .reduce((sum, t) => sum + Number(t.weight_kg), 0)

  const totalCumulativeWeight = copperWeight + ewasteWeight + aluminumWeight

  // Recharts Bar Data
  const rateMap = Object.fromEntries(rates.map((r) => [r.material_code, Number(r.rate_per_kg)]))
  const chartData = [
    {
      material: "Copper",
      weight: parseFloat(copperWeight.toFixed(2)),
      color: "#d97706",
      rate: rateMap["COPPER"] ?? 500,
    },
    {
      material: "E-Waste",
      weight: parseFloat(ewasteWeight.toFixed(2)),
      color: "#059669",
      rate: rateMap["EWASTE"] ?? 50,
    },
    {
      material: "Aluminum",
      weight: parseFloat(aluminumWeight.toFixed(2)),
      color: "#64748b",
      rate: rateMap["ALUMINUM"] ?? 150,
    },
  ]

  // DBT Queue Calculations: Group by collector_phone, qualify if > 20kg
  const collectorMap = new Map<string, { totalWeight: number; transactionCount: number }>()

  transactions.forEach((tx) => {
    const current = collectorMap.get(tx.collector_phone) || { totalWeight: 0, transactionCount: 0 }
    collectorMap.set(tx.collector_phone, {
      totalWeight: parseFloat((current.totalWeight + Number(tx.weight_kg)).toFixed(3)),
      transactionCount: current.transactionCount + 1,
    })
  })

  const allCollectors: CollectorDBTSummary[] = []
  collectorMap.forEach((val, phone) => {
    const isEligible = val.totalWeight >= 20
    allCollectors.push({
      phone,
      totalWeight: val.totalWeight,
      transactionCount: val.transactionCount,
      isEligible,
      remainingKg: Math.max(0, parseFloat((20 - val.totalWeight).toFixed(2))),
    })
  })

  const eligibleCollectors = allCollectors.filter((c) => c.isEligible)
  eligibleCollectors.sort((a, b) => b.totalWeight - a.totalWeight)

  const inProgressCollectors = allCollectors.filter((c) => !c.isEligible)
  inProgressCollectors.sort((a, b) => b.totalWeight - a.totalWeight)

  return (
    <div className="min-h-screen bg-stone-50 text-stone-900 flex flex-col font-sans">
      {/* 1. Header & Official Branding */}
      <header className="border-b border-stone-200 bg-white/95 backdrop-blur sticky top-0 z-30 px-4 py-3 sm:px-8">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 border border-blue-200 text-blue-700">
              <ShieldCheck className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono font-bold tracking-widest text-blue-700 uppercase">
                  GOVERNMENT OF INDIA
                </span>
                <span className="text-stone-300">•</span>
                <span className="text-xs text-stone-500 font-medium">MINISTRY OF MINES</span>
              </div>
              <h1 className="text-base sm:text-lg font-bold tracking-tight text-stone-900 leading-tight">
                Dhatu Setu
              </h1>
              <p className="text-xs text-stone-500 font-medium">
                Critical Mineral Traceability Network (CMTN)
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-end">
            <div className="flex items-center gap-2 text-xs font-mono text-stone-600 bg-stone-100 px-3 py-1.5 rounded-lg border border-stone-200">
              <span className="h-2 w-2 rounded-full bg-green-600 animate-pulse" />
              <span>LIVE FEED</span>
              {lastUpdated && (
                <span className="text-stone-500 hidden sm:inline">({lastUpdated})</span>
              )}
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={fetchTransactions}
              disabled={loading}
              className="border-stone-300 bg-white hover:bg-stone-100 text-stone-700 text-xs font-semibold gap-1.5 h-8 shadow-sm"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
              <span>Sync</span>
            </Button>

            <Link href="/pos">
              <Button
                size="sm"
                className="bg-green-700 hover:bg-green-800 text-white text-xs font-bold gap-1.5 h-8 shadow-sm border-0"
              >
                <Scale className="h-3.5 w-3.5" />
                <span>Aggregator POS</span>
                <ArrowUpRight className="h-3.5 w-3.5" />
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Main Dashboard Workspace */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
        {/* Error Notification if Supabase Table not initialized */}
        {error && (
          <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-900 flex items-start gap-3 text-sm">
            <AlertCircle className="h-5 w-5 text-red-600 shrink-0 mt-0.5" />
            <div className="flex-1">
              <div className="font-semibold text-red-900">Live Connection Notice</div>
              <div className="text-xs text-red-700 mt-0.5">{error}</div>
              <div className="text-xs text-red-600 mt-1">
                Make sure you have executed <code className="bg-red-100 px-1 rounded text-red-900">supabase/schema.sql</code> in your Supabase SQL editor.
              </div>
            </div>
            <Button
              size="xs"
              variant="outline"
              onClick={fetchTransactions}
              className="border-red-300 text-red-800 hover:bg-red-100 text-xs shrink-0"
            >
              Retry
            </Button>
          </div>
        )}

        {/* 2. High-Level KPI Metrics (Top Row) */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-bold tracking-widest text-stone-700 uppercase flex items-center gap-2">
              <Activity className="h-4 w-4 text-blue-600" />
              Real-Time Mineral Intake Aggregations
            </h2>
            <span className="text-xs text-stone-500 font-mono">
              Total Logged: <strong className="text-stone-900">{transactions.length}</strong> transactions
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* KPI Card 1: Copper */}
            <Card className="border-stone-200 bg-white text-stone-900 shadow-sm relative overflow-hidden">
              <div className="absolute top-0 left-0 right-0 h-1 bg-amber-600" />
              <CardHeader className="pb-2 flex flex-row items-start justify-between">
                <div>
                  <CardDescription className="text-xs font-bold uppercase tracking-wider text-amber-700">
                    Critical Mineral 01
                  </CardDescription>
                  <CardTitle className="text-sm sm:text-base font-semibold text-stone-700 mt-0.5">
                    Total Copper Recovered
                  </CardTitle>
                </div>
                <Badge variant="outline" className="border-amber-300 bg-amber-50 text-amber-900 font-mono text-[10px]">
                  Cu • ₹{rateMap["COPPER"] ?? 500}/kg
                </Badge>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl sm:text-4xl font-black font-mono tracking-tight text-stone-900">
                    {copperWeight.toLocaleString("en-IN", { minimumFractionDigits: 1, maximumFractionDigits: 2 })}
                  </span>
                  <span className="text-sm font-semibold font-mono text-amber-700">kg</span>
                </div>
                <p className="text-xs text-stone-500 mt-2 flex items-center justify-between">
                  <span>Share of intake:</span>
                  <span className="font-mono text-stone-700">
                    {totalCumulativeWeight > 0
                      ? `${((copperWeight / totalCumulativeWeight) * 100).toFixed(1)}%`
                      : "0.0%"}
                  </span>
                </p>
              </CardContent>
            </Card>

            {/* KPI Card 2: E-Waste */}
            <Card className="border-stone-200 bg-white text-stone-900 shadow-sm relative overflow-hidden">
              <div className="absolute top-0 left-0 right-0 h-1 bg-emerald-600" />
              <CardHeader className="pb-2 flex flex-row items-start justify-between">
                <div>
                  <CardDescription className="text-xs font-bold uppercase tracking-wider text-emerald-700">
                    Critical Mineral 02
                  </CardDescription>
                  <CardTitle className="text-sm sm:text-base font-semibold text-stone-700 mt-0.5">
                    Total E-Waste Recovered
                  </CardTitle>
                </div>
                <Badge variant="outline" className="border-emerald-300 bg-emerald-50 text-emerald-900 font-mono text-[10px]">
                  PCB • ₹{rateMap["EWASTE"] ?? 50}/kg
                </Badge>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl sm:text-4xl font-black font-mono tracking-tight text-stone-900">
                    {ewasteWeight.toLocaleString("en-IN", { minimumFractionDigits: 1, maximumFractionDigits: 2 })}
                  </span>
                  <span className="text-sm font-semibold font-mono text-emerald-700">kg</span>
                </div>
                <p className="text-xs text-stone-500 mt-2 flex items-center justify-between">
                  <span>Share of intake:</span>
                  <span className="font-mono text-stone-700">
                    {totalCumulativeWeight > 0
                      ? `${((ewasteWeight / totalCumulativeWeight) * 100).toFixed(1)}%`
                      : "0.0%"}
                  </span>
                </p>
              </CardContent>
            </Card>

            {/* KPI Card 3: Aluminum */}
            <Card className="border-stone-200 bg-white text-stone-900 shadow-sm relative overflow-hidden">
              <div className="absolute top-0 left-0 right-0 h-1 bg-slate-500" />
              <CardHeader className="pb-2 flex flex-row items-start justify-between">
                <div>
                  <CardDescription className="text-xs font-bold uppercase tracking-wider text-slate-600">
                    Critical Mineral 03
                  </CardDescription>
                  <CardTitle className="text-sm sm:text-base font-semibold text-stone-700 mt-0.5">
                    Total Aluminum Recovered
                  </CardTitle>
                </div>
                <Badge variant="outline" className="border-slate-300 bg-slate-100 text-slate-800 font-mono text-[10px]">
                  Al • ₹{rateMap["ALUMINUM"] ?? 150}/kg
                </Badge>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl sm:text-4xl font-black font-mono tracking-tight text-stone-900">
                    {aluminumWeight.toLocaleString("en-IN", { minimumFractionDigits: 1, maximumFractionDigits: 2 })}
                  </span>
                  <span className="text-sm font-semibold font-mono text-slate-600">kg</span>
                </div>
                <p className="text-xs text-stone-500 mt-2 flex items-center justify-between">
                  <span>Share of intake:</span>
                  <span className="font-mono text-stone-700">
                    {totalCumulativeWeight > 0
                      ? `${((aluminumWeight / totalCumulativeWeight) * 100).toFixed(1)}%`
                      : "0.0%"}
                  </span>
                </p>
              </CardContent>
            </Card>
          </div>
        </section>

        {/* 3. Data Visualization (Middle Row): Recharts Bar Chart */}
        <section>
          <Card className="border-stone-200 bg-white text-stone-900 shadow-sm">
            <CardHeader className="border-b border-stone-100 pb-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <CardTitle className="text-base sm:text-lg font-bold text-stone-900 flex items-center gap-2">
                    <Layers className="h-5 w-5 text-blue-600" />
                    Collection Volume by Mineral
                  </CardTitle>
                  <CardDescription className="text-xs sm:text-sm text-stone-500 mt-0.5">
                    Aggregated godown weighing intake volume in kilograms (KG)
                  </CardDescription>
                </div>

                <div className="flex items-center gap-4 text-xs font-mono">
                  <div className="flex items-center gap-1.5">
                    <span className="h-3 w-3 rounded-sm bg-amber-600" />
                    <span className="text-stone-700 font-medium">Copper</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="h-3 w-3 rounded-sm bg-emerald-600" />
                    <span className="text-stone-700 font-medium">E-Waste</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="h-3 w-3 rounded-sm bg-slate-500" />
                    <span className="text-stone-700 font-medium">Aluminum</span>
                  </div>
                </div>
              </div>
            </CardHeader>

            <CardContent className="pt-6 pb-4">
              <div className="h-72 sm:h-80 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={chartData}
                    margin={{ top: 20, right: 30, left: 10, bottom: 20 }}
                  >
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="#e2e8f0"
                      vertical={false}
                    />
                    <XAxis
                      dataKey="material"
                      stroke="#64748b"
                      fontSize={13}
                      tickLine={false}
                      axisLine={{ stroke: "#cbd5e1" }}
                    />
                    <YAxis
                      stroke="#64748b"
                      fontSize={12}
                      tickLine={false}
                      axisLine={{ stroke: "#cbd5e1" }}
                      unit=" kg"
                      width={65}
                    />
                    <Tooltip
                      content={<CustomBarTooltip />}
                      cursor={{ fill: "rgba(241, 245, 249, 0.7)" }}
                    />
                    <Bar
                      dataKey="weight"
                      name="Total Weight"
                      radius={[8, 8, 0, 0]}
                      maxBarSize={90}
                    >
                      {chartData.map((entry) => (
                        <Cell
                          key={`cell-${entry.material}`}
                          fill={entry.color}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div className="mt-2 pt-3 border-t border-stone-100 flex flex-wrap items-center justify-between text-xs text-stone-500">
                <span>Metric: Verified scale gross intake weight (kg)</span>
                <span className="font-mono">
                  Cumulative Total:{" "}
                  <strong className="text-stone-800">
                    {totalCumulativeWeight.toLocaleString("en-IN", { minimumFractionDigits: 1 })} kg
                  </strong>
                </span>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* 3b. India Facility Network Map */}
        <section>
          <Card className="border-stone-200 bg-white text-stone-900 shadow-sm overflow-hidden">
            <CardHeader className="border-b border-stone-100 pb-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <CardTitle className="text-base sm:text-lg font-bold text-stone-900 flex items-center gap-2">
                    <MapPin className="h-5 w-5 text-blue-600" />
                    National Facility Network
                  </CardTitle>
                  <CardDescription className="text-xs sm:text-sm text-stone-500 mt-0.5">
                    Live facility throughput across India — marker size scales with volume
                  </CardDescription>
                </div>
                <div className="flex items-center gap-4 text-xs font-mono">
                  <div className="flex items-center gap-1.5">
                    <span className="h-3 w-3 rounded-full bg-emerald-600" />
                    <span className="text-stone-700 font-medium">Aggregator Godown</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="h-3 w-3 rounded-full bg-blue-600" />
                    <span className="text-stone-700 font-medium">Formal Recycler</span>
                  </div>
                </div>
              </div>
            </CardHeader>

            <CardContent className="p-4 sm:p-6">
              {facilityMap.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center gap-3">
                  <MapPin className="h-10 w-10 text-stone-300" />
                  <div className="text-sm font-semibold text-stone-500">No facility coordinates loaded</div>
                  <p className="text-xs text-stone-400 max-w-xs">
                    Run <code className="bg-stone-100 px-1 rounded text-stone-700">supabase/add_coordinates.sql</code> in your Supabase SQL editor to seed facility lat/lon data and enable the map.
                  </p>
                </div>
              ) : (
                <>
              {/* Map container — relative so tooltip can be absolutely positioned */}
              <div className="relative w-full select-none" style={{ paddingBottom: "62%" }}>
                {/* ── India SVG outline ── */}
                <svg
                  className="absolute inset-0 w-full h-full"
                  viewBox="0 0 600 370"
                  preserveAspectRatio="xMidYMid meet"
                  xmlns="http://www.w3.org/2000/svg"
                  onMouseLeave={() => setMapTooltip(null)}
                >
                  {/* Subtle grid lines */}
                  <defs>
                    <pattern id="grid" width="30" height="30" patternUnits="userSpaceOnUse">
                      <path d="M 30 0 L 0 0 0 30" fill="none" stroke="#f1f5f9" strokeWidth="0.5"/>
                    </pattern>
                  </defs>
                  <rect width="600" height="370" fill="url(#grid)" rx="8"/>

                  {/*
                    India outline path — hand-traced simplified polygon.
                    ViewBox is 600×370.
                    Projection: lat 8–37°N → y 340–10px (inverted), lon 68–97°E → x 30–570px
                    Formula: x = (lon - 68) / 29 * 540 + 30
                              y = (37 - lat) / 29 * 330 + 10
                  */}
                  <path
                    d="
                      M 205,10
                      L 280,15 L 360,10 L 420,25 L 460,20 L 500,35
                      L 510,60 L 530,80 L 540,110 L 535,140
                      L 560,160 L 570,185 L 555,200 L 540,190
                      L 520,210 L 510,240 L 490,260 L 470,285
                      L 450,310 L 430,335 L 415,350 L 405,345
                      L 395,330 L 385,310 L 370,290 L 355,275
                      L 340,295 L 325,315 L 310,340 L 295,355
                      L 280,350 L 265,330 L 250,310 L 235,285
                      L 220,260 L 210,240 L 195,220 L 180,210
                      L 165,220 L 150,240 L 135,255 L 120,245
                      L 105,225 L 95,200 L 80,180 L 70,160
                      L 60,140 L 55,115 L 65,90 L 80,70
                      L 100,55 L 125,40 L 155,25 L 185,15
                      Z
                    "
                    fill="#f8fafc"
                    stroke="#cbd5e1"
                    strokeWidth="1.5"
                    strokeLinejoin="round"
                  />

                  {/* State boundary hint lines — very subtle */}
                  <path d="M 280,15 L 275,80 L 310,130 L 295,200" fill="none" stroke="#e2e8f0" strokeWidth="0.8" strokeDasharray="4,4"/>
                  <path d="M 360,10 L 350,70 L 380,120 L 400,180" fill="none" stroke="#e2e8f0" strokeWidth="0.8" strokeDasharray="4,4"/>
                  <path d="M 180,210 L 240,215 L 310,210 L 380,215 L 440,210" fill="none" stroke="#e2e8f0" strokeWidth="0.8" strokeDasharray="4,4"/>

                  {/* ── Facility markers ── */}
                  {facilityMap.map((f) => {
                    const LAT_MIN = 8, LAT_MAX = 37
                    const LON_MIN = 68, LON_MAX = 97
                    const SVG_W = 540, SVG_H = 330
                    const MARGIN_X = 30, MARGIN_Y = 10
                    const cx = ((f.longitude - LON_MIN) / (LON_MAX - LON_MIN)) * SVG_W + MARGIN_X
                    const cy = ((LAT_MAX - f.latitude) / (LAT_MAX - LAT_MIN)) * SVG_H + MARGIN_Y

                    const isAgg = f.type === "Aggregator"
                    const color = isAgg ? "#059669" : "#2563eb"
                    const strokeColor = isAgg ? "#047857" : "#1d4ed8"

                    // Scale marker radius: base 8px, max 22px based on volume
                    const maxVol = Math.max(...facilityMap.map((x) => x.volumeKg), 1)
                    const r = 8 + Math.round((f.volumeKg / maxVol) * 14)

                    return (
                      <g key={f.id}
                        style={{ cursor: "pointer" }}
                        onMouseEnter={(e) => {
                          try {
                            const svgEl = (e.currentTarget as SVGGElement).closest("svg") as SVGSVGElement | null
                            if (!svgEl) return
                            const rect = svgEl.getBoundingClientRect()
                            const container = svgEl.parentElement?.getBoundingClientRect()
                            if (!rect || !container) return
                            const scaleX = rect.width / 600
                            const scaleY = rect.height / 370
                            setMapTooltip({
                              facility: f,
                              x: cx * scaleX,
                              y: cy * scaleY,
                            })
                          } catch {
                            // silently ignore tooltip positioning errors
                          }
                        }}
                        onMouseLeave={() => setMapTooltip(null)}
                      >
                        {/* Pulse ring */}
                        <circle cx={cx} cy={cy} r={r + 5} fill="none"
                          stroke={color} strokeWidth="1" opacity="0.25"
                          className="animate-ping" style={{ transformOrigin: `${cx}px ${cy}px` }}
                        />
                        {/* Main circle */}
                        <circle
                          cx={cx} cy={cy} r={r}
                          fill={color} fillOpacity="0.9"
                          stroke={strokeColor} strokeWidth="1.5"
                          style={{ filter: "drop-shadow(0 1px 2px rgba(0,0,0,0.15))" }}
                        />
                        {/* Icon dot */}
                        <circle cx={cx} cy={cy} r={2.5} fill="white" opacity="0.9"/>
                        {/* Volume label if non-zero */}
                        {f.volumeKg > 0 && (
                          <text x={cx} y={cy - r - 5} textAnchor="middle"
                            fontSize="8" fontFamily="monospace" fill="#0f172a" fontWeight="bold">
                            {f.volumeKg.toFixed(0)}kg
                          </text>
                        )}
                      </g>
                    )
                  })}
                </svg>

                {/* Floating tooltip — positioned in pixels relative to the container */}
                {mapTooltip && (
                  <div
                    className="pointer-events-none absolute z-20 rounded-xl border border-stone-200 bg-white p-3 shadow-xl text-xs min-w-[180px]"
                    style={{
                      left: Math.min(mapTooltip.x + 14, 10000),
                      top: Math.max(mapTooltip.y - 70, 4),
                      transform: mapTooltip.x > 400 ? "translateX(-110%)" : "translateX(0)",
                    }}
                  >
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className={`h-2 w-2 rounded-full flex-shrink-0 ${mapTooltip.facility.type === "Aggregator" ? "bg-emerald-600" : "bg-blue-600"}`} />
                      <span className="font-bold text-stone-900 text-[11px]">{mapTooltip.facility.name}</span>
                    </div>
                    <div className="text-stone-500 text-[10px] mb-1">{mapTooltip.facility.location}</div>
                    <div className="flex items-center justify-between gap-3 mt-1.5 pt-1.5 border-t border-stone-100">
                      <Badge variant="outline" className={`text-[9px] font-bold px-1.5 py-0 ${mapTooltip.facility.type === "Aggregator" ? "border-emerald-300 text-emerald-800 bg-emerald-50" : "border-blue-300 text-blue-800 bg-blue-50"}`}>
                        {mapTooltip.facility.type}
                      </Badge>
                      <span className="font-mono font-bold text-stone-900 text-[11px]">
                        {mapTooltip.facility.volumeKg > 0 ? `${mapTooltip.facility.volumeKg.toFixed(1)} kg` : "No data yet"}
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* Facility legend list below the map */}
              <div className="mt-4 pt-3 border-t border-stone-100 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                {facilityMap.map((f) => (
                  <div key={f.id} className="flex items-center gap-2 text-xs text-stone-600">
                    <span className={`h-2 w-2 rounded-full flex-shrink-0 ${f.type === "Aggregator" ? "bg-emerald-600" : "bg-blue-600"}`} />
                    <span className="font-medium text-stone-800 truncate">{f.name}</span>
                    <span className="ml-auto font-mono text-stone-500 shrink-0">
                      {f.volumeKg > 0 ? `${f.volumeKg.toFixed(1)} kg` : "—"}
                    </span>
                  </div>
                ))}
              </div>
                </>
              )}
            </CardContent>
          </Card>
        </section>

        {/* 4. The "DBT Eligibility" Ledger (Bottom Row) */}

        <section className="space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h2 className="text-base sm:text-lg font-bold text-stone-900 flex items-center gap-2">
                <Award className="h-5 w-5 text-green-700" />
                Direct Benefit Transfer (DBT) Queue
              </h2>
              <p className="text-xs sm:text-sm text-stone-500">
                Ministry of Mines threshold: Collectors with &gt; 20kg cumulative verified recovery qualify for government direct benefit payout.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <Badge variant="outline" className="border-emerald-300 bg-emerald-50 text-emerald-800 font-mono text-xs px-2.5 py-1">
                {eligibleCollectors.length} Beneficiaries Qualified
              </Badge>
            </div>
          </div>

          <Card className="border-stone-200 bg-white shadow-sm overflow-hidden">
            <Table>
              <TableHeader className="bg-stone-50 border-b border-stone-200">
                <TableRow className="border-stone-200 hover:bg-transparent">
                  <TableHead className="font-bold text-stone-700 w-[240px]">
                    Kabadiwala ID (Phone)
                  </TableHead>
                  <TableHead className="font-bold text-stone-700 text-right">
                    Total Volume Contributed (kg)
                  </TableHead>
                  <TableHead className="font-bold text-stone-700 text-center">
                    Intake Batches
                  </TableHead>
                  <TableHead className="font-bold text-stone-700 text-right w-[280px]">
                    DBT Status
                  </TableHead>
                </TableRow>
              </TableHeader>

              <TableBody>
                {eligibleCollectors.length === 0 ? (
                  <TableRow className="border-stone-200 hover:bg-transparent">
                    <TableCell colSpan={4} className="text-center py-10">
                      <div className="flex flex-col items-center justify-center gap-2 max-w-md mx-auto">
                        <Clock className="h-8 w-8 text-stone-400" />
                        <div className="font-semibold text-stone-700 text-sm">
                          No Kabadiwalas Currently Qualified (&gt;20kg)
                        </div>
                        <p className="text-xs text-stone-500 text-center">
                          Collectors who accumulate 20kg or more of critical minerals at any registered aggregator weighing scale will automatically appear in this government payout queue.
                        </p>
                        <Link href="/pos" className="mt-2">
                          <Button size="sm" variant="outline" className="border-stone-300 hover:bg-stone-100 text-stone-700 text-xs gap-1.5">
                            <Scale className="h-3.5 w-3.5 text-green-700" />
                            Log intake on POS Terminal
                          </Button>
                        </Link>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  eligibleCollectors.map((collector) => (
                    <TableRow
                      key={collector.phone}
                      className="border-stone-200 hover:bg-stone-50/80 transition-colors"
                    >
                      <TableCell className="font-mono font-semibold text-stone-900">
                        <div className="flex items-center gap-2">
                          <span className="text-xs bg-stone-100 px-2 py-0.5 rounded text-stone-600 border border-stone-200">
                            🇮🇳 +91
                          </span>
                          <span>
                            {collector.phone.slice(0, 5)} {collector.phone.slice(5)}
                          </span>
                        </div>
                      </TableCell>

                      <TableCell className="text-right font-mono font-bold text-stone-900 text-base">
                        {collector.totalWeight.toLocaleString("en-IN", {
                          minimumFractionDigits: 1,
                          maximumFractionDigits: 3,
                        })}{" "}
                        <span className="text-xs font-normal text-stone-500">kg</span>
                      </TableCell>

                      <TableCell className="text-center font-mono text-xs text-stone-500">
                        {collector.transactionCount} {collector.transactionCount === 1 ? "batch" : "batches"}
                      </TableCell>

                      <TableCell className="text-right">
                        <Badge
                          variant="outline"
                          className="border-emerald-300 bg-emerald-50 text-emerald-800 font-semibold text-xs px-3 py-1 shadow-none gap-1.5"
                        >
                          <CheckCircle2 className="h-3.5 w-3.5 text-green-700" />
                          Eligible: ₹500 Bonus Pending
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>

            {/* In-Progress Pipeline Tracker */}
            {inProgressCollectors.length > 0 && (
              <div className="border-t border-stone-200 bg-stone-50 p-4">
                <div className="text-xs font-bold uppercase tracking-wider text-stone-600 mb-2 flex items-center justify-between">
                  <span>Collectors Approaching DBT Qualification (&lt; 20kg)</span>
                  <span className="font-mono text-stone-500">{inProgressCollectors.length} Active</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {inProgressCollectors.slice(0, 6).map((c) => {
                    const progressPercent = Math.min(100, Math.round((c.totalWeight / 20) * 100))
                    return (
                      <div
                        key={c.phone}
                        className="rounded-lg border border-stone-200 bg-white p-2.5 text-xs flex flex-col justify-between gap-1.5 shadow-sm"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-mono font-medium text-stone-800">
                            +91 {c.phone}
                          </span>
                          <span className="font-mono text-stone-600 font-bold">
                            {c.totalWeight} / 20 kg
                          </span>
                        </div>
                        <div className="w-full bg-stone-200 rounded-full h-1.5 overflow-hidden">
                          <div
                            className="bg-green-600 h-full rounded-full transition-all duration-300"
                            style={{ width: `${progressPercent}%` }}
                          />
                        </div>
                        <div className="text-[11px] text-stone-500 flex justify-between">
                          <span>{progressPercent}% achieved</span>
                          <span className="text-amber-800 font-mono font-semibold">{c.remainingKg} kg to DBT</span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </Card>
        </section>

        {/* 5. Material Rate Management — MoM Admin Card */}
        <section className="space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h2 className="text-base sm:text-lg font-bold text-stone-900 flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-green-700" />
                Material Rate Management
              </h2>
              <p className="text-xs sm:text-sm text-stone-500">
                Adjust per-kg purchase rates. Changes take effect at all Aggregator POS terminals instantly via realtime sync.
              </p>
            </div>
            <Badge variant="outline" className="border-stone-300 bg-stone-100 text-stone-700 font-mono text-xs px-2.5 py-1">
              MoM Admin
            </Badge>
          </div>

          <Card className="border-stone-200 bg-white shadow-sm overflow-hidden">
            <div className="divide-y divide-stone-200">
              {[
                { code: "COPPER", label: "Copper", symbol: "Cu", accent: "amber", iconColor: "text-amber-800", borderColor: "border-amber-200", bgColor: "bg-amber-50" },
                { code: "EWASTE", label: "E-Waste", symbol: "PCB", accent: "emerald", iconColor: "text-emerald-800", borderColor: "border-emerald-200", bgColor: "bg-emerald-50" },
                { code: "ALUMINUM", label: "Aluminum", symbol: "Al", accent: "slate", iconColor: "text-slate-800", borderColor: "border-slate-200", bgColor: "bg-slate-100" },
              ].map(({ code, label, symbol, iconColor, borderColor, bgColor }) => {
                const currentRate = rateMap[code] ?? 0
                const editVal = editRates[code] ?? String(currentRate)
                const isSaving = savingRate === code
                const isDirty = parseFloat(editVal) !== currentRate
                const rateEntry = rates.find((r) => r.material_code === code)
                return (
                  <div key={code} className="flex flex-col sm:flex-row sm:items-center gap-4 p-4 sm:p-5 hover:bg-stone-50 transition-colors">
                    {/* Material Info */}
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border ${borderColor} ${bgColor}`}>
                        <span className={`text-xs font-black font-mono ${iconColor}`}>{symbol}</span>
                      </div>
                      <div className="min-w-0">
                        <div className="font-semibold text-stone-900 text-sm">{label}</div>
                        <div className="text-[11px] text-stone-500 font-mono truncate">
                          Current: ₹{currentRate}/kg
                          {rateEntry && (
                            <span className="ml-2 text-stone-400">
                              · Updated {new Date(rateEntry.updated_at).toLocaleDateString("en-IN")}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Rate Edit Input + Save */}
                    <div className="flex items-center gap-2 sm:w-64">
                      <div className="relative flex-1">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400 font-bold text-sm pointer-events-none">₹</span>
                        <Input
                          type="number"
                          min="1"
                          step="1"
                          value={editVal}
                          onChange={(e) =>
                            setEditRates((prev) => ({ ...prev, [code]: e.target.value }))
                          }
                          className="pl-7 h-9 font-mono text-sm bg-white border-stone-300 focus-visible:border-green-600 text-stone-900"
                          placeholder="Enter rate"
                        />
                      </div>
                      <span className="text-stone-500 text-sm font-mono shrink-0">/kg</span>
                      <Button
                        size="sm"
                        onClick={() => saveRate(code)}
                        disabled={isSaving || !isDirty}
                        className="h-9 px-3 gap-1.5 bg-green-700 hover:bg-green-800 text-white text-xs font-bold disabled:opacity-40 shrink-0"
                      >
                        {isSaving ? (
                          <><Pencil className="h-3.5 w-3.5 animate-pulse" />Saving...</>
                        ) : isDirty ? (
                          <><Save className="h-3.5 w-3.5" />Save</>
                        ) : (
                          <><CheckCircle2 className="h-3.5 w-3.5" />Saved</>
                        )}
                      </Button>
                    </div>
                  </div>
                )
              })}
            </div>
          </Card>
        </section>
      </main>

      {/* Official Government Footer */}
      <footer className="border-t border-stone-200 bg-white px-4 py-3 text-center text-xs text-stone-500 mt-auto">
        Ministry of Mines (MoM) • National Critical Mineral Mission • Automated Direct Benefit Transfer (DBT) Clearinghouse
      </footer>
    </div>
  )
}
