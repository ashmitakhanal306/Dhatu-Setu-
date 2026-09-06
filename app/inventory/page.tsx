"use client"

import * as React from "react"
import { useState, useEffect, useCallback, useMemo } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { getSession, clearSession, type UserSession } from "@/lib/session"
import { supabase, type MaterialCode, type Dispatch, type IntakeTransaction } from "@/lib/supabase"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { toast } from "@/components/ui/toast"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Truck,
  PackageCheck,
  Scale,
  RefreshCw,
  ArrowLeft,
  Building2,
  AlertTriangle,
  Send,
  Loader2,
  ShieldCheck,
  CheckCircle2,
  History,
  ArrowRight,
  TrendingDown,
  TrendingUp,
  LogOut,
  Clock,
  AlertCircle,
} from "lucide-react"

interface MaterialStockInfo {
  code: MaterialCode
  name: string
  intakeWeight: number
  dispatchedWeight: number
  currentStock: number
  color: string
  activeBorder: string
  badgeColor: string
}

interface FormalRecycler {
  id: string
  name: string
  location: string
  specialty: string
}

const FALLBACK_RECYCLERS: FormalRecycler[] = [
  {
    id: "rec-001",
    name: "National E-Waste Corp (ID: rec-001)",
    location: "Sriperumbudur, Tamil Nadu",
    specialty: "High-grade circuit boards & critical mineral hydrometallurgy",
  },
  {
    id: "rec-002",
    name: "Hindalco Metals (ID: rec-002)",
    location: "Dahej, Gujarat",
    specialty: "Closed-loop secondary aluminum smelting & alloy casting",
  },
  {
    id: "rec-003",
    name: "Bharat Copper Ltd (ID: rec-003)",
    location: "Khetri, Rajasthan",
    specialty: "Certified electrolytic copper cathode refining",
  },
]

const MATERIAL_META: Record<MaterialCode, { name: string; color: string; border: string; badge: string }> = {
  COPPER: {
    name: "Copper",
    color: "from-amber-600 to-orange-500",
    border: "border-amber-200",
    badge: "border-amber-300 bg-amber-50 text-amber-900",
  },
  ALUMINUM: {
    name: "Aluminum",
    color: "from-slate-500 to-slate-400",
    border: "border-slate-200",
    badge: "border-slate-300 bg-slate-100 text-slate-800",
  },
  EWASTE: {
    name: "E-Waste",
    color: "from-emerald-600 to-green-600",
    border: "border-emerald-200",
    badge: "border-green-300 bg-green-50 text-green-900",
  },
}

export default function InventoryDispatchPage() {
  const router = useRouter()
  const [session, setSessionState] = useState<UserSession | null>(null)
  const [isAuthChecking, setIsAuthChecking] = useState<boolean>(true)
  const [intakes, setIntakes] = useState<IntakeTransaction[]>([])
  const [dispatches, setDispatches] = useState<Dispatch[]>([])
  const [loading, setLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [lastSync, setLastSync] = useState<string>("")
  const [formalRecyclers, setFormalRecyclers] = useState<FormalRecycler[]>(FALLBACK_RECYCLERS)

  // Auth Guard
  useEffect(() => {
    const s = getSession()
    if (!s || s.role !== "Aggregator") {
      router.replace("/")
    } else {
      setSessionState(s)
      setIsAuthChecking(false)
    }
  }, [router])

  // Form State
  const [selectedMaterial, setSelectedMaterial] = useState<MaterialCode>("COPPER")
  const [dispatchWeight, setDispatchWeight] = useState<string>("")
  const [selectedRecyclerId, setSelectedRecyclerId] = useState<string>(FALLBACK_RECYCLERS[0].id)
  const [formError, setFormError] = useState<string | null>(null)

  // Fetch Live Formal Recyclers from Supabase
  useEffect(() => {
    async function loadFormalRecyclers() {
      try {
        const { data, error } = await supabase
          .from("facilities")
          .select("*")
          .eq("type", "Formal Recycler")
          .order("name", { ascending: true })

        if (!error && data && data.length > 0) {
          const mapped: FormalRecycler[] = data.map((fac) => ({
            id: fac.id,
            name: `${fac.name} (ID: ${fac.id})`,
            location: fac.location,
            specialty: `${fac.name} certified formal recycling facility`,
          }))
          setFormalRecyclers(mapped)
          setSelectedRecyclerId((prev) => (mapped.some((m) => m.id === prev) ? prev : mapped[0].id))
        }
      } catch {
        // Fallback to FALLBACK_RECYCLERS
      }
    }
    loadFormalRecyclers()
  }, [])

  // Fetch Inventory and Dispatch Data
  const fetchInventoryData = useCallback(async () => {
    try {
      setLoading(true)
      const currentSession = getSession()
      const facilityId = currentSession?.facilityId

      let intakeQuery = supabase.from("intake_transactions").select("*")
      let dispatchQuery = supabase.from("dispatches").select("*").order("timestamp", { ascending: false })

      if (facilityId) {
        intakeQuery = intakeQuery.eq("aggregator_id", facilityId)
        dispatchQuery = dispatchQuery.eq("aggregator_id", facilityId)
      }

      const [{ data: intakeData, error: intakeErr }, { data: dispatchData, error: dispatchErr }] =
        await Promise.all([intakeQuery, dispatchQuery])

      if (intakeErr) throw intakeErr
      if (dispatchErr) throw dispatchErr

      setIntakes((intakeData as IntakeTransaction[]) || [])
      setDispatches((dispatchData as Dispatch[]) || [])
      setLastSync(
        new Date().toLocaleTimeString("en-IN", {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        })
      )
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error syncing inventory"
      console.error(msg)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchInventoryData()

    // Real-time listener for intake or dispatch updates
    const channel = supabase
      .channel("realtime-inventory-sync")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "intake_transactions" },
        () => fetchInventoryData()
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "dispatches" },
        () => fetchInventoryData()
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [fetchInventoryData])

  // Calculate Current Stock for each material: (Total Intake) - (Total Dispatched)
  const stocks: Record<MaterialCode, MaterialStockInfo> = useMemo(() => {
    const codes: MaterialCode[] = ["COPPER", "ALUMINUM", "EWASTE"]
    const map = {} as Record<MaterialCode, MaterialStockInfo>

    codes.forEach((code) => {
      const totalIntake = intakes
        .filter((i) => i.material_code === code)
        .reduce((sum, i) => sum + Number(i.weight_kg), 0)

      const totalDispatched = dispatches
        .filter((d) => d.material_code === code && d.status !== "REJECTED")
        .reduce((sum, d) => sum + Number(d.weight_kg), 0)

      const current = Math.max(0, parseFloat((totalIntake - totalDispatched).toFixed(3)))

      map[code] = {
        code,
        name: MATERIAL_META[code].name,
        intakeWeight: parseFloat(totalIntake.toFixed(3)),
        dispatchedWeight: parseFloat(totalDispatched.toFixed(3)),
        currentStock: current,
        color: MATERIAL_META[code].color,
        activeBorder: MATERIAL_META[code].border,
        badgeColor: MATERIAL_META[code].badge,
      }
    })

    return map
  }, [intakes, dispatches])

  // Currently available stock for the active material selection
  const currentAvailableStock = stocks[selectedMaterial]?.currentStock || 0
  const parsedWeight = parseFloat(dispatchWeight) || 0
  const isOverStock = parsedWeight > currentAvailableStock

  const handleAuthorizeDispatch = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!dispatchWeight || isNaN(parsedWeight) || parsedWeight <= 0) {
      setFormError("Please specify a valid numeric dispatch weight (> 0 kg).")
      toast({
        title: "Invalid Dispatch Weight",
        description: "Please enter a valid numeric weight greater than 0 kg.",
        type: "error",
      })
      return
    }

    // Validation: dispatch weight cannot exceed current stock
    if (parsedWeight > currentAvailableStock) {
      const msg = `Insufficient inventory! You attempted to dispatch ${parsedWeight}kg, but only ${currentAvailableStock}kg of ${stocks[selectedMaterial].name} is in stock.`
      setFormError(msg)
      toast({
        title: "Dispatch Exceeds Inventory",
        description: msg,
        type: "error",
      })
      return
    }

    setIsSubmitting(true)
    setFormError(null)

    const submittedWeight = parsedWeight
    const submittedMaterialName = stocks[selectedMaterial].name
    const submittedRecyclerId = selectedRecyclerId

    try {
      const activeSession = getSession()
      const aggregatorId = activeSession?.facilityId || session?.facilityId
      if (!aggregatorId) {
        throw new Error("No active aggregator session found. Please log in again.")
      }

      // INSERT into dispatches table
      const { error: dispatchError } = await supabase.from("dispatches").insert({
        aggregator_id: aggregatorId,
        recycler_id: submittedRecyclerId,
        material_code: selectedMaterial,
        weight_kg: submittedWeight,
      })

      if (dispatchError) {
        throw dispatchError
      }

      // 4. Success Feedback (Demo Magic)
      // Clear form
      setDispatchWeight("")

      // Trigger shadcn/ui Toast notification
      toast({
        title: "🚚 Dispatch Authorized",
        description: `Securely transferred ${submittedWeight}kg of ${submittedMaterialName} to the formal recycling chain. Ledger updated.`,
        type: "success",
      })

      // Instantly refresh stock cards to reflect deduction
      await fetchInventoryData()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to record dispatch in ledger"
      setFormError(msg)
      toast({
        title: "Authorization Error",
        description: msg,
        type: "error",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleSetMaxWeight = () => {
    if (currentAvailableStock > 0) {
      setDispatchWeight(currentAvailableStock.toString())
      setFormError(null)
    }
  }

  if (isAuthChecking) {
    return (
      <div className="min-h-screen bg-stone-50 flex flex-col items-center justify-center text-stone-600 gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-green-700" />
        <p className="text-xs uppercase tracking-widest font-mono text-stone-500">
          Verifying Aggregator Session...
        </p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-stone-50 text-stone-900 flex flex-col font-sans select-none">
      {/* Top Bar Header */}
      <header className="border-b border-stone-200 bg-white/95 backdrop-blur sticky top-0 z-30 px-4 py-3 sm:px-8">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 text-xs text-stone-600 hover:text-stone-900 transition-colors p-1.5 rounded-md hover:bg-stone-100"
            >
              <ArrowLeft className="h-4 w-4" />
              <span>Hub</span>
            </Link>
            <div className="h-4 w-px bg-stone-200" />
            <div className="flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-50 border border-amber-200 text-amber-700">
                <Truck className="h-5 w-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono font-bold tracking-widest text-amber-700 uppercase">
                    AGGREGATOR TERMINAL
                  </span>
                  <span className="text-stone-300">•</span>
                  <span className="text-xs text-stone-700 font-medium">
                    {session?.facilityName || "Aggregator Godown"}
                  </span>
                  <span className="text-xs text-stone-500 font-mono hidden sm:inline">
                    ({session?.facilityId})
                  </span>
                </div>
                <h1 className="text-base sm:text-lg font-bold tracking-tight text-stone-900 leading-tight">
                  Inventory & Formal Dispatch Terminal
                </h1>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-end">
            <div className="flex items-center gap-2 text-xs font-mono text-stone-600 bg-stone-100 px-3 py-1.5 rounded-lg border border-stone-200">
              <span className="h-2 w-2 rounded-full bg-green-600 animate-pulse" />
              <span>LEDGER SYNC</span>
              {lastSync && <span className="text-stone-500 hidden sm:inline">({lastSync})</span>}
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={fetchInventoryData}
              disabled={loading}
              className="border-stone-300 bg-white hover:bg-stone-100 text-stone-700 text-xs font-semibold gap-1.5 h-8 shadow-sm"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
              <span>Refresh</span>
            </Button>

            <Link href="/dashboard">
              <Button
                size="sm"
                variant="outline"
                className="border-stone-300 bg-white hover:bg-stone-100 text-stone-700 text-xs font-bold gap-1.5 h-8 shadow-sm"
              >
                <ShieldCheck className="h-3.5 w-3.5 text-stone-600" />
                <span>MoM Dashboard</span>
              </Button>
            </Link>

            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                clearSession()
                router.replace("/")
              }}
              className="border-stone-300 bg-white hover:bg-red-50 hover:border-red-300 text-stone-700 hover:text-red-700 text-xs font-semibold gap-1.5 h-8 transition-colors"
            >
              <LogOut className="h-3.5 w-3.5" />
              <span>Switch account</span>
            </Button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8 space-y-8">
        {/* 1. Current Stock Overview (Top Section) */}
        <section className="space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
            <div>
              <h2 className="text-xs font-bold tracking-widest text-stone-700 uppercase flex items-center gap-2">
                <PackageCheck className="h-4 w-4 text-amber-700" />
                Current Warehouse Inventory (Net Available Stock)
              </h2>
              <p className="text-xs text-stone-500">
                Formula: [Total Intake from Kabadiwalas] − [Total Dispatched to Formal Recyclers]
              </p>
            </div>
            <div className="text-xs text-stone-500 font-mono">
              Aggregator Facility ID: <span className="text-stone-800 font-bold">agg-001</span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {(["COPPER", "ALUMINUM", "EWASTE"] as MaterialCode[]).map((code) => {
              const item = stocks[code]
              return (
                <Card
                  key={code}
                  className={`border-2 ${item.activeBorder} bg-white text-stone-900 shadow-sm relative overflow-hidden transition-all`}
                >
                  <CardHeader className="pb-2 flex flex-row items-start justify-between">
                    <div>
                      <CardDescription className="text-xs font-bold uppercase tracking-wider text-stone-500">
                        {item.name} Stock
                      </CardDescription>
                      <CardTitle className="text-base sm:text-lg font-bold text-stone-900 mt-0.5">
                        {item.name}
                      </CardTitle>
                    </div>
                    <Badge variant="outline" className={`font-mono text-xs px-2.5 py-0.5 ${item.badgeColor}`}>
                      {code}
                    </Badge>
                  </CardHeader>

                  <CardContent className="space-y-4 pt-1">
                    <div>
                      <div className="text-xs text-stone-500 uppercase font-semibold">Current Stock</div>
                      <div className="flex items-baseline gap-2 mt-0.5">
                        <span className="text-3xl sm:text-4xl font-black font-mono tracking-tight text-stone-900">
                          {item.currentStock.toLocaleString("en-IN", {
                            minimumFractionDigits: 1,
                            maximumFractionDigits: 3,
                          })}
                        </span>
                        <span className="text-sm font-semibold font-mono text-amber-700">kg</span>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 pt-3 border-t border-stone-200 text-xs font-mono">
                      <div className="p-2 rounded-lg bg-stone-50 border border-stone-200">
                        <div className="text-[10px] text-green-700 font-semibold flex items-center gap-1">
                          <TrendingUp className="h-3 w-3" />
                          Gross Intake
                        </div>
                        <div className="text-sm font-bold text-stone-800 mt-0.5">
                          {item.intakeWeight.toLocaleString("en-IN", { minimumFractionDigits: 1 })} kg
                        </div>
                      </div>

                      <div className="p-2 rounded-lg bg-stone-50 border border-stone-200">
                        <div className="text-[10px] text-slate-600 font-semibold flex items-center gap-1">
                          <TrendingDown className="h-3 w-3" />
                          Dispatched
                        </div>
                        <div className="text-sm font-bold text-stone-800 mt-0.5">
                          {item.dispatchedWeight.toLocaleString("en-IN", { minimumFractionDigits: 1 })} kg
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        </section>

        {/* 2. The Dispatch Form (Middle Section) */}
        <section className="space-y-3">
          <div>
            <h2 className="text-base sm:text-lg font-bold text-stone-900 flex items-center gap-2">
              <Truck className="h-5 w-5 text-green-700" />
              Dispatch to Formal Recycler
            </h2>
            <p className="text-xs sm:text-sm text-stone-500">
              Authorize an official chain-of-custody transfer from godown inventory to an authorized Ministry of Mines recycler.
            </p>
          </div>

          <Card className="border-stone-200 bg-white shadow-sm overflow-hidden">
            <CardContent className="p-5 sm:p-7">
              {formError && (
                <div className="mb-6 p-4 rounded-xl bg-red-50 border border-red-200 text-red-900 flex items-center gap-3 text-sm animate-in fade-in duration-200">
                  <AlertTriangle className="h-5 w-5 text-red-600 shrink-0" />
                  <div className="flex-1">{formError}</div>
                  <button
                    onClick={() => setFormError(null)}
                    className="text-xs underline hover:text-red-950 font-semibold"
                  >
                    Dismiss
                  </button>
                </div>
              )}

              <form onSubmit={handleAuthorizeDispatch} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Field 1: Material Dropdown */}
                  <div className="space-y-2">
                    <label className="text-xs sm:text-sm font-bold tracking-wider text-stone-700 uppercase flex items-center justify-between">
                      <span>Select Material</span>
                      <span className="text-xs font-mono text-stone-600 font-semibold">
                        Available: {currentAvailableStock} kg
                      </span>
                    </label>

                    <div className="relative">
                      <select
                        value={selectedMaterial}
                        onChange={(e) => {
                          setSelectedMaterial(e.target.value as MaterialCode)
                          if (formError) setFormError(null)
                        }}
                        className="h-14 w-full rounded-xl border-2 border-stone-300 bg-white px-4 text-base font-semibold text-stone-900 focus:border-green-600 focus:outline-none transition-colors appearance-none cursor-pointer"
                      >
                        <option value="COPPER">Copper (In Stock: {stocks.COPPER.currentStock} kg)</option>
                        <option value="ALUMINUM">Aluminum (In Stock: {stocks.ALUMINUM.currentStock} kg)</option>
                        <option value="EWASTE">E-Waste (In Stock: {stocks.EWASTE.currentStock} kg)</option>
                      </select>
                      <div className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-stone-500">
                        ▼
                      </div>
                    </div>
                  </div>

                  {/* Field 2: Weight Input */}
                  <div className="space-y-2">
                    <label className="text-xs sm:text-sm font-bold tracking-wider text-stone-700 uppercase flex items-center justify-between">
                      <span className="flex items-center gap-1.5">
                        <Scale className="h-4 w-4 text-green-700" />
                        Dispatch Weight (in KG)
                      </span>
                      {isOverStock && (
                        <span className="text-xs text-red-600 font-bold animate-pulse">
                          Exceeds Stock ({currentAvailableStock} kg)
                        </span>
                      )}
                    </label>

                    <div className="relative">
                      <Input
                        type="number"
                        step="0.1"
                        min="0.1"
                        max={currentAvailableStock}
                        placeholder="0.0"
                        value={dispatchWeight}
                        onChange={(e) => {
                          setDispatchWeight(e.target.value)
                          if (formError) setFormError(null)
                        }}
                        className={`h-14 pl-4 pr-24 text-xl sm:text-2xl font-mono font-bold bg-white border-2 rounded-xl text-stone-900 placeholder:text-stone-400 ${
                          isOverStock
                            ? "border-red-500 focus-visible:border-red-500"
                            : "border-stone-300 focus-visible:border-green-600"
                        }`}
                      />
                      <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                        <button
                          type="button"
                          onClick={handleSetMaxWeight}
                          className="text-xs font-mono font-semibold px-2.5 py-1 rounded bg-stone-100 hover:bg-stone-200 text-stone-800 border border-stone-300 transition-colors"
                          title="Set to max available stock"
                        >
                          MAX
                        </button>
                        <span className="text-xs font-mono font-bold text-stone-500 px-2">kg</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Field 3: Formal Recycler Selection */}
                <div className="space-y-2">
                  <label className="text-xs sm:text-sm font-bold tracking-wider text-stone-700 uppercase flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <Building2 className="h-4 w-4 text-green-700" />
                      MoM-Registered Formal Recycler (Destination)
                    </span>
                    <span className="text-xs text-green-700 font-semibold">
                      ✓ MoM Compliance Certified
                    </span>
                  </label>

                  <div className="relative">
                    <select
                      value={selectedRecyclerId}
                      onChange={(e) => setSelectedRecyclerId(e.target.value)}
                      className="h-14 w-full rounded-xl border-2 border-stone-300 bg-white px-4 text-sm sm:text-base font-semibold text-stone-900 focus:border-green-600 focus:outline-none transition-colors appearance-none cursor-pointer"
                    >
                      {formalRecyclers.map((recycler) => (
                        <option key={recycler.id} value={recycler.id}>
                          {recycler.name} — {recycler.location}
                        </option>
                      ))}
                    </select>
                    <div className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-stone-500">
                      ▼
                    </div>
                  </div>

                  {/* Selected Recycler Details Note */}
                  {(() => {
                    const activeRecycler = formalRecyclers.find((r) => r.id === selectedRecyclerId)
                    return activeRecycler ? (
                      <div className="p-3 rounded-lg bg-stone-50 border border-stone-200 text-xs text-stone-600 flex items-center justify-between">
                        <span>
                          <strong className="text-stone-800">Certified Specialty:</strong> {activeRecycler.specialty}
                        </span>
                        <span className="font-mono text-stone-500">ID: {activeRecycler.id}</span>
                      </div>
                    ) : null
                  })()}
                </div>

                {/* Submit Button: AUTHORIZE DISPATCH */}
                <Button
                  type="submit"
                  disabled={isSubmitting || currentAvailableStock <= 0}
                  className="w-full h-16 sm:h-18 text-lg sm:text-xl font-black tracking-wider uppercase rounded-xl bg-green-700 hover:bg-green-800 text-white disabled:opacity-40 disabled:cursor-not-allowed shadow-sm transition-all border-0"
                >
                  {isSubmitting ? (
                    <span className="flex items-center gap-2.5">
                      <Loader2 className="h-6 w-6 animate-spin" />
                      AUTHORIZING CHAIN DISPATCH...
                    </span>
                  ) : (
                    <span className="flex items-center gap-2">
                      <Truck className="h-6 w-6" />
                      <span>AUTHORIZE DISPATCH</span>
                      {parsedWeight > 0 && !isOverStock && (
                        <span className="font-mono text-sm bg-green-800 text-white px-2 py-0.5 rounded border border-green-600">
                          {parsedWeight} kg {stocks[selectedMaterial].name}
                        </span>
                      )}
                    </span>
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>
        </section>

        {/* 3. Formal Chain Dispatch History Ledger */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-bold tracking-widest text-stone-700 uppercase flex items-center gap-2">
              <History className="h-4 w-4 text-green-700" />
              Verified Formal Chain Dispatches (Audit Log)
            </h2>
            <span className="text-xs font-mono text-stone-500">
              Total Dispatched: <strong className="text-stone-800">{dispatches.length}</strong> consignments
            </span>
          </div>

          <Card className="border-stone-200 bg-white shadow-sm overflow-hidden">
            <Table>
              <TableHeader className="bg-stone-50 border-b border-stone-200">
                <TableRow className="border-stone-200 hover:bg-transparent">
                  <TableHead className="font-bold text-stone-700">Timestamp</TableHead>
                  <TableHead className="font-bold text-stone-700">Material</TableHead>
                  <TableHead className="font-bold text-stone-700">Destination Recycler</TableHead>
                  <TableHead className="font-bold text-stone-700 text-right">Dispatched Weight</TableHead>
                  <TableHead className="font-bold text-stone-700 text-center">MoM Status</TableHead>
                </TableRow>
              </TableHeader>

              <TableBody>
                {dispatches.length === 0 ? (
                  <TableRow className="border-stone-200 hover:bg-transparent">
                    <TableCell colSpan={5} className="text-center py-8 text-stone-500 text-xs">
                      No bulk dispatches recorded yet for this aggregator terminal. Once authorized, dispatches are logged here in real time.
                    </TableCell>
                  </TableRow>
                ) : (
                  dispatches.map((d) => {
                    const recycler = formalRecyclers.find((r) => r.id === d.recycler_id)
                    const formattedDate = new Date(d.timestamp).toLocaleString("en-IN", {
                      day: "2-digit",
                      month: "short",
                      hour: "2-digit",
                      minute: "2-digit",
                    })

                    return (
                      <TableRow key={d.id} className="border-stone-200 hover:bg-stone-50/80">
                        <TableCell className="font-mono text-xs text-stone-500">
                          {formattedDate}
                        </TableCell>

                        <TableCell>
                          <Badge
                            variant="outline"
                            className={`font-mono text-xs ${
                              MATERIAL_META[d.material_code]?.badge || "border-stone-300"
                            }`}
                          >
                            {d.material_code}
                          </Badge>
                        </TableCell>

                        <TableCell className="text-sm font-medium text-stone-800">
                          {recycler ? recycler.name : d.recycler_id}
                        </TableCell>

                        <TableCell className="text-right font-mono font-bold text-stone-900 text-base">
                          {Number(d.weight_kg).toLocaleString("en-IN", { minimumFractionDigits: 1 })}{" "}
                          <span className="text-xs font-normal text-stone-500">kg</span>
                        </TableCell>

                        <TableCell className="text-center">
                          {(!d.status || d.status === "PENDING") && (
                            <Badge className="bg-amber-50 text-amber-900 border border-amber-300 text-xs gap-1.5 font-medium">
                              <Clock className="h-3 w-3 text-amber-700 animate-pulse" />
                              Waiting for recycler to confirm
                            </Badge>
                          )}
                          {d.status === "ACCEPTED" && (
                            <div className="inline-flex flex-col items-center gap-0.5">
                              <Badge className="bg-green-50 text-green-900 border border-green-300 text-xs gap-1.5 font-medium">
                                <CheckCircle2 className="h-3 w-3 text-green-700" />
                                Confirmed received
                              </Badge>
                              {d.received_weight_kg != null && (
                                <span className="text-[10px] font-mono text-stone-500">
                                  Verified: {Number(d.received_weight_kg).toFixed(1)} kg
                                </span>
                              )}
                            </div>
                          )}
                          {d.status === "REJECTED" && (
                            <div className="inline-flex flex-col items-center gap-0.5">
                              <Badge className="bg-red-50 text-red-900 border border-red-300 text-xs gap-1.5 font-medium">
                                <AlertCircle className="h-3 w-3 text-red-700" />
                                Rejected
                              </Badge>
                              {d.rejection_reason && (
                                <span
                                  className="text-[10px] text-red-700 max-w-[200px] truncate"
                                  title={d.rejection_reason}
                                >
                                  &quot;{d.rejection_reason}&quot;
                                </span>
                              )}
                            </div>
                          )}
                        </TableCell>
                      </TableRow>
                    )
                  })
                )}
              </TableBody>
            </Table>
          </Card>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-stone-200 bg-white px-4 py-3 text-center text-xs text-stone-500 mt-auto">
        Aggregator Godown Operations Terminal • Ministry of Mines (MoM) Critical Mineral Custody Chain
      </footer>
    </div>
  )
}
