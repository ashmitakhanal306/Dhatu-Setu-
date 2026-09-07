"use client"

import * as React from "react"
import { useState, useEffect, useMemo, useCallback } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { toast } from "@/components/ui/toast"
import { supabase, type MaterialCode, type Facility } from "@/lib/supabase"
import {
  Phone,
  Scale,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  Coins,
  ArrowLeft,
  MessageSquareText,
  Loader2,
  RefreshCw,
  LogOut,
  TrendingUp,
  ExternalLink,
  Zap,
  Package,
  Cpu,
  Truck,
  ChevronDown,
  Send,
} from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { getSession, clearSession, type UserSession } from "@/lib/session"

interface MaterialConfig {
  code: MaterialCode
  name: string
  rate: number
  icon: React.ElementType
  activeBorder: string
  activeBg: string
  iconBg: string
}

// Static config with default fallback rates (overridden dynamically by DB material_rates table)
const MATERIALS_BASE: MaterialConfig[] = [
  {
    code: "COPPER",
    name: "Copper",
    rate: 500,
    icon: Zap,
    activeBorder: "border-amber-600 ring-2 ring-amber-500",
    activeBg: "bg-amber-50",
    iconBg: "bg-amber-100 border-amber-300 text-amber-800",
  },
  {
    code: "ALUMINUM",
    name: "Aluminum",
    rate: 150,
    icon: Package,
    activeBorder: "border-slate-500 ring-2 ring-slate-400",
    activeBg: "bg-slate-100",
    iconBg: "bg-slate-200 border-slate-300 text-slate-800",
  },
  {
    code: "EWASTE",
    name: "E-Waste",
    rate: 50,
    icon: Cpu,
    activeBorder: "border-green-600 ring-2 ring-green-500",
    activeBg: "bg-green-50",
    iconBg: "bg-green-100 border-green-300 text-green-800",
  },
]

export default function AggregatorPOSPage() {
  const router = useRouter()
  const [session, setSessionState] = useState<UserSession | null>(null)
  const [isAuthChecking, setIsAuthChecking] = useState<boolean>(true)
  const [phone, setPhone] = useState("")
  const [materials, setMaterials] = useState<MaterialConfig[]>(MATERIALS_BASE)
  const [ratesLoaded, setRatesLoaded] = useState(true)
  const [selectedMaterial, setSelectedMaterial] = useState<MaterialConfig>(MATERIALS_BASE[0])
  const [weight, setWeight] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  // ── Dispatch state ───────────────────────────────────────────────────
  const [recyclers, setRecyclers] = useState<Facility[]>([])
  const [loadingRecyclers, setLoadingRecyclers] = useState(true)
  const [dispatchRecyclerId, setDispatchRecyclerId] = useState("")
  const [dispatchMaterial, setDispatchMaterial] = useState<MaterialCode>("COPPER")
  const [dispatchWeight, setDispatchWeight] = useState("")
  const [isDispatching, setIsDispatching] = useState(false)
  const [dispatchError, setDispatchError] = useState<string | null>(null)

  // Fetch current rates from DB and merge into MATERIALS_BASE
  const fetchRates = useCallback(async () => {
    const { data, error } = await supabase
      .from("material_rates")
      .select("material_code, rate_per_kg")
    if (error || !data) return
    const rateMap: Record<string, number> = {}
    data.forEach((row: { material_code: string; rate_per_kg: number }) => {
      rateMap[row.material_code] = Number(row.rate_per_kg)
    })
    setMaterials((prev) =>
      prev.map((m) => ({
        ...m,
        rate: rateMap[m.code] ?? m.rate,
      }))
    )
    setSelectedMaterial((prev) => ({
      ...prev,
      rate: rateMap[prev.code] ?? prev.rate,
    }))
    setRatesLoaded(true)
  }, [])

  useEffect(() => {
    const s = getSession()
    if (!s || s.role !== "Aggregator") {
      router.replace("/")
    } else {
      setSessionState(s)
      setIsAuthChecking(false)
    }
  }, [router])

  // Fetch rates on mount and subscribe to realtime changes
  useEffect(() => {
    fetchRates()
    const channel = supabase
      .channel("realtime-pos-rates")
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
    }
  }, [fetchRates])

  // Load formal recyclers for the dispatch dropdown
  useEffect(() => {
    async function loadRecyclers() {
      setLoadingRecyclers(true)
      const { data, error } = await supabase
        .from("facilities")
        .select("id, name, location, type, pin")
        .eq("type", "Formal Recycler")
        .order("name")
      if (!error && data && data.length > 0) {
        setRecyclers(data as Facility[])
        setDispatchRecyclerId((data as Facility[])[0].id)
      } else {
        // Demo fallback
        const demo: Facility[] = [
          { id: "rec-001", name: "National E-Waste Corp", location: "Sriperumbudur, Tamil Nadu", type: "Formal Recycler", pin: "1234" },
          { id: "rec-002", name: "Hindalco Metals", location: "Dahej, Gujarat", type: "Formal Recycler", pin: "1234" },
          { id: "rec-003", name: "Bharat Copper Ltd", location: "Khetri, Rajasthan", type: "Formal Recycler", pin: "1234" },
        ]
        setRecyclers(demo)
        setDispatchRecyclerId(demo[0].id)
      }
      setLoadingRecyclers(false)
    }
    loadRecyclers()
  }, [])

  const handleDispatch = async (e: React.FormEvent) => {
    e.preventDefault()
    setDispatchError(null)
    const w = parseFloat(dispatchWeight)
    if (!dispatchRecyclerId) { setDispatchError("Select a recycler."); return }
    if (isNaN(w) || w <= 0) { setDispatchError("Enter a valid weight > 0."); return }

    const activeSession = getSession()
    const aggregatorId = activeSession?.facilityId || session?.facilityId
    if (!aggregatorId) { setDispatchError("No active session. Please log in again."); return }

    setIsDispatching(true)
    try {
      const { error } = await supabase.from("dispatches").insert({
        aggregator_id: aggregatorId,
        recycler_id: dispatchRecyclerId,
        material_code: dispatchMaterial,
        weight_kg: w,
        status: "PENDING",
      })
      if (error) throw error
      toast({
        title: "✅ Dispatch Sent",
        description: `${w} kg of ${dispatchMaterial} dispatched. Awaiting recycler confirmation.`,
        type: "success",
      })
      setDispatchWeight("")
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Dispatch failed"
      setDispatchError(msg)
      toast({ title: "Dispatch Error", description: msg, type: "error" })
    } finally {
      setIsDispatching(false)
    }
  }
  const [recentSms, setRecentSms] = useState<{
    phone: string
    weight: string
    material: string
    payout: string
    timestamp: string
  } | null>(null)

  // Live Payout Calculation
  const numericWeight = parseFloat(weight) || 0
  const totalPayout = useMemo(() => {
    return Math.round(numericWeight * selectedMaterial.rate)
  }, [numericWeight, selectedMaterial.rate])

  // Phone validation: exactly 10 digits
  const cleanPhone = phone.replace(/\D/g, "").slice(0, 10)
  const isPhoneValid = cleanPhone.length === 10
  const isWeightValid = numericWeight > 0
  const isFormReady = isPhoneValid && isWeightValid && !isSubmitting

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/\D/g, "").slice(0, 10)
    setPhone(raw)
    if (errorMessage) setErrorMessage(null)
  }

  const handleWeightChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value
    if (val === "" || /^\d*\.?\d*$/.test(val)) {
      setWeight(val)
      if (errorMessage) setErrorMessage(null)
    }
  }

  const handleQuickAddWeight = (increment: number) => {
    const current = parseFloat(weight) || 0
    const updated = Math.max(0, parseFloat((current + increment).toFixed(2)))
    setWeight(updated.toString())
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!isPhoneValid) {
      setErrorMessage("Please enter a valid 10-digit Kabadiwala mobile number.")
      return
    }

    if (!isWeightValid) {
      setErrorMessage("Please enter a valid weight in kg (> 0).")
      return
    }

    setIsSubmitting(true)
    setErrorMessage(null)

    const submissionPhone = cleanPhone
    const submissionWeight = numericWeight
    const submissionMaterial = selectedMaterial.name
    const submissionPayoutFormatted = totalPayout.toLocaleString("en-IN")

    try {
      // 1. UPSERT collector to ensure FK exists, default dbt_eligible to false
      const { error: collectorError } = await supabase
        .from("collectors")
        .upsert(
          {
            phone: submissionPhone,
            name: `Collector ${submissionPhone.slice(-4)}`,
            dbt_eligible: false,
          },
          {
            onConflict: "phone",
            ignoreDuplicates: true,
          }
        )

      if (collectorError) {
        throw new Error(`Collector registration failed: ${collectorError.message}`)
      }

      // 2. Use active session aggregator ID directly (no hardcoding or fallback)
      const activeSession = getSession()
      const aggregatorId = activeSession?.facilityId || session?.facilityId
      if (!aggregatorId) {
        throw new Error("No active aggregator session found. Please log in again.")
      }

      // 3. INSERT intake transaction
      const { error: intakeError } = await supabase
        .from("intake_transactions")
        .insert({
          collector_phone: submissionPhone,
          aggregator_id: aggregatorId,
          material_code: selectedMaterial.code,
          weight_kg: submissionWeight,
        })

      if (intakeError) {
        throw new Error(`Intake logging failed: ${intakeError.message}`)
      }

      // 4. Simulated SMS Toast (Crucial Demo Feature)
      const smsTitle = `📱 SMS Sent to +91 ${submissionPhone}`
      const smsDescription = `Paid ₹${submissionPayoutFormatted} for ${submissionWeight}kg ${submissionMaterial.toLowerCase()}. Keep collecting — bonuses unlock at higher weights!`

      toast({
        title: smsTitle,
        description: smsDescription,
        type: "success",
      })

      // Store in recent SMS demo preview state
      setRecentSms({
        phone: submissionPhone,
        weight: submissionWeight.toString(),
        material: submissionMaterial,
        payout: submissionPayoutFormatted,
        timestamp: new Date().toLocaleTimeString("en-IN", {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        }),
      })

      // 5. Clear Form
      setPhone("")
      setWeight("")
      setSelectedMaterial((prev) => materials.find((m) => m.code === prev.code) ?? materials[0])
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Database error occurred during intake"
      setErrorMessage(msg)
      toast({
        title: "Intake Error",
        description: msg,
        type: "error",
      })
    } finally {
      setIsSubmitting(false)
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
    <div className="min-h-screen bg-stone-50 text-stone-900 flex flex-col justify-between select-none">
      {/* Top Bar Navigation */}
      <header className="border-b border-stone-200 bg-white/95 backdrop-blur px-4 py-3 sm:px-6">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 text-xs text-stone-600 hover:text-stone-900 transition-colors p-1.5 rounded-md hover:bg-stone-100"
            >
              <ArrowLeft className="h-4 w-4" />
              <span>Hub</span>
            </Link>
            <div className="h-4 w-px bg-stone-200" />
            <span className="text-xs uppercase tracking-widest font-semibold text-green-800 flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-green-600 animate-pulse" />
              <span>{session?.facilityName || "Aggregator Godown"}</span>
              <span className="text-stone-500 hidden sm:inline font-mono">({session?.facilityId})</span>
            </span>
          </div>

          <div className="flex items-center gap-3">
            <div className="text-xs text-stone-600 hidden sm:flex items-center gap-2">
              <span>Ministry of Mines</span>
              <span className="text-stone-300">•</span>
              <span className="font-mono text-stone-700">MoM-DBT v1.0</span>
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                clearSession()
                router.replace("/")
              }}
              className="h-8 px-2.5 text-xs font-semibold text-stone-700 hover:text-red-700 border-stone-300 hover:border-red-300 bg-white hover:bg-red-50 gap-1.5 transition-colors"
            >
              <LogOut className="h-3.5 w-3.5" />
              <span>Switch account</span>
            </Button>
          </div>
        </div>
      </header>

      {/* Main Terminal Container */}
      <main className="flex-1 max-w-6xl w-full mx-auto p-4 sm:p-6 lg:p-8 flex flex-col justify-center">
        {/* Massive Bold Header */}
        <div className="mb-6">
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight text-stone-900 uppercase">
            Aggregator Intake Terminal
          </h1>
          <p className="text-stone-500 text-sm sm:text-base mt-1">
            Log scrap intake and pay collectors directly from the godown scale.
          </p>
        </div>

        {/* Error Banner if any */}
        {errorMessage && (
          <div className="mb-6 p-4 rounded-xl bg-red-50 border border-red-200 text-red-900 flex items-center gap-3 text-sm animate-in fade-in duration-200">
            <AlertCircle className="h-5 w-5 text-red-600 shrink-0" />
            <div className="flex-1">{errorMessage}</div>
            <button
              onClick={() => setErrorMessage(null)}
              className="text-xs underline hover:text-red-950 font-semibold"
            >
              Dismiss
            </button>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Section 1: Phone Number Input */}
          <div className="space-y-2">
            <label className="text-xs sm:text-sm font-bold tracking-wider text-stone-700 uppercase flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Phone className="h-4 w-4 text-green-700" />
                Phone Number
              </span>
              <span
                className={`font-mono text-xs ${
                  isPhoneValid
                    ? "text-green-700 font-bold"
                    : cleanPhone.length > 0
                    ? "text-amber-700 font-semibold"
                    : "text-stone-400"
                }`}
              >
                {cleanPhone.length}/10 Digits
              </span>
            </label>

            <div className="relative">
              <div className="absolute left-4 top-1/2 -translate-y-1/2 flex items-center gap-2 pointer-events-none text-stone-500 font-bold text-lg">
                <span className="text-sm bg-stone-100 px-2 py-1 rounded text-stone-700 border border-stone-300">
                  🇮🇳 +91
                </span>
              </div>
              <Input
                type="tel"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={10}
                placeholder="Enter 10-digit mobile number"
                value={phone}
                onChange={handlePhoneChange}
                className="h-16 pl-24 pr-12 text-xl sm:text-2xl font-mono tracking-widest bg-white border-2 border-stone-300 focus-visible:border-green-600 rounded-xl text-stone-900 placeholder:text-stone-400 shadow-sm"
              />
              {isPhoneValid && (
                <div className="absolute right-4 top-1/2 -translate-y-1/2 text-green-700">
                  <CheckCircle2 className="h-6 w-6" />
                </div>
              )}
            </div>
          </div>

          {/* Section 2: Material Selection */}
          <div className="space-y-2">
            <label className="text-xs sm:text-sm font-bold tracking-wider text-stone-700 uppercase">
              Select Material
            </label>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
              {materials.map((mat) => {
                const isSelected = selectedMaterial.code === mat.code
                const Icon = mat.icon
                return (
                  <Card
                    key={mat.code}
                    onClick={() => setSelectedMaterial(mat)}
                    className={`cursor-pointer transition-all duration-150 border-2 relative overflow-hidden active:scale-[0.98] ${
                      isSelected
                        ? `${mat.activeBorder} ${mat.activeBg} shadow-sm`
                        : "border-stone-200 bg-white hover:border-stone-300 hover:bg-stone-50"
                    }`}
                  >
                    <CardContent className="p-4 sm:p-5 flex items-center justify-between">
                      <div className="flex items-center gap-3.5">
                        <div
                          className={`p-3 rounded-xl border ${
                            isSelected
                              ? mat.iconBg
                              : "bg-stone-100 border-stone-200 text-stone-600"
                          }`}
                        >
                          <Icon className="h-6 w-6" />
                        </div>
                        <div>
                          <div className="text-lg sm:text-xl font-bold text-stone-900">
                            {mat.name}
                          </div>
                          <div className="text-base font-mono font-bold text-stone-700 mt-0.5">
                            ₹{mat.rate}/kg
                          </div>
                        </div>
                      </div>

                      {isSelected && (
                        <div className="h-6 w-6 rounded-full bg-green-700 flex items-center justify-center text-white shrink-0">
                          <CheckCircle2 className="h-4 w-4" />
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          </div>

          {/* Section 3: Weight Input */}
          <div className="space-y-2">
            <label className="text-xs sm:text-sm font-bold tracking-wider text-stone-700 uppercase">
              Scale Weight (kg)
            </label>

            <div className="space-y-2">
              <div className="relative">
                <Input
                  type="number"
                  step="0.1"
                  min="0.1"
                  placeholder="0.0"
                  value={weight}
                  onChange={handleWeightChange}
                  className="h-16 pl-6 pr-20 text-2xl sm:text-3xl font-mono font-bold bg-white border-2 border-stone-300 focus-visible:border-green-600 rounded-xl text-stone-900 placeholder:text-stone-400 shadow-sm"
                />
                <div className="absolute right-4 top-1/2 -translate-y-1/2 font-mono font-bold text-lg text-stone-600 bg-stone-100 px-3 py-1 rounded-lg border border-stone-300 pointer-events-none">
                  kg
                </div>
              </div>

              {/* Tablet Quick-Tap Weight Increments */}
              <div className="flex gap-2">
                {[1, 5, 10, 25, 50].map((inc) => (
                  <button
                    key={inc}
                    type="button"
                    onClick={() => handleQuickAddWeight(inc)}
                    className="flex-1 py-2.5 rounded-lg bg-white border border-stone-200 hover:border-stone-300 hover:bg-stone-100 active:bg-stone-200 text-xs sm:text-sm font-mono font-semibold text-stone-800 transition-colors shadow-sm"
                  >
                    +{inc}kg
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => setWeight("")}
                  className="px-4 py-2.5 rounded-lg bg-white border border-stone-200 hover:bg-stone-100 text-xs text-stone-500 transition-colors shadow-sm"
                  title="Clear Weight"
                >
                  <RefreshCw className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>

          {/* Section 4: Live Payout Calculator */}
          <div className="rounded-2xl border-2 border-green-600/40 bg-green-50/80 p-5 sm:p-6 shadow-sm relative overflow-hidden">
            <div className="absolute -right-8 -bottom-8 opacity-10 pointer-events-none text-green-700">
              <Coins className="h-44 w-44" />
            </div>

            <div className="flex items-center justify-between gap-3">
              <div className="text-xs sm:text-sm font-bold uppercase tracking-widest text-green-800 flex items-center gap-1.5">
                <Sparkles className="h-4 w-4 text-green-700" />
                Live Payout
              </div>

              <div className="text-2xl sm:text-4xl lg:text-5xl font-black font-mono tracking-tight text-green-800">
                You&apos;ll pay: ₹{totalPayout.toLocaleString("en-IN")}
              </div>
            </div>
          </div>

          {/* Section 5: Giant Submit Button */}
          <Button
            type="submit"
            disabled={!isFormReady}
            className="w-full h-16 sm:h-20 text-lg sm:text-2xl font-black tracking-wider uppercase rounded-2xl bg-green-700 hover:bg-green-800 text-white disabled:opacity-40 disabled:cursor-not-allowed shadow-sm transition-all active:scale-[0.99] border-0"
          >
            {isSubmitting ? (
              <span className="flex items-center gap-3">
                <Loader2 className="h-7 w-7 animate-spin" />
                Processing Intake...
              </span>
            ) : (
              <span className="flex items-center gap-3">
                <span>LOG INTAKE & PAY</span>
                <span className="text-green-950 font-mono text-base sm:text-xl font-bold bg-green-100 px-3 py-1 rounded-lg">
                  ₹{totalPayout.toLocaleString("en-IN")}
                </span>
              </span>
            )}
          </Button>
        </form>

        {/* Section 6: Simulated SMS Live Preview (Demo Feedback) */}
        {recentSms && (
          <div className="mt-6 p-4 rounded-xl bg-white border border-stone-200 text-left animate-in slide-in-from-bottom-2 duration-300 shadow-sm">
            <div className="flex items-center justify-between text-xs text-green-800 font-semibold mb-2">
              <span className="flex items-center gap-1.5">
                <MessageSquareText className="h-4 w-4 text-green-700" />
                Latest Simulated SMS Dispatched • {recentSms.timestamp}
              </span>
              <span className="font-mono text-stone-500">+91 {recentSms.phone}</span>
            </div>
            <p className="text-sm font-mono text-stone-800 bg-stone-50 p-3 rounded-lg border border-stone-200">
              📱 &quot;Paid ₹{recentSms.payout} for {recentSms.weight}kg {recentSms.material.toLowerCase()}. Keep collecting — bonuses unlock at higher weights!&quot;
            </p>
            {/* Digital ID quick-link */}
            <div className="mt-3 flex items-center justify-between">
              <span className="text-[11px] text-stone-500">Tap to view collector&apos;s verified income proof:</span>
              <a
                href={`/collector/${recentSms.phone}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-xs font-bold text-green-800 hover:text-green-900 bg-green-50 hover:bg-green-100 border border-green-300 px-3 py-1.5 rounded-lg transition-all"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                View Digital ID
              </a>
            </div>
          </div>
        )}

        {/* ── Section 7: Dispatch to Recycler ──────────────────────── */}
        <div className="mt-10 pt-8 border-t-2 border-dashed border-stone-300">
          <div className="mb-5 flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-100 border border-blue-200 text-blue-700">
              <Truck className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-xl sm:text-2xl font-black tracking-tight text-stone-900 uppercase">
                Dispatch Batch to Recycler
              </h2>
              <p className="text-xs text-stone-500 mt-0.5">
                Send a verified batch from your godown to a formal recycling plant.
              </p>
            </div>
          </div>

          <form onSubmit={handleDispatch} className="space-y-4">
            {/* Recycler dropdown */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-stone-700 flex items-center justify-between">
                <span>Target Recycling Plant</span>
                {loadingRecyclers && (
                  <span className="flex items-center gap-1 text-[11px] text-stone-400 font-normal">
                    <Loader2 className="h-3 w-3 animate-spin" /> Loading...
                  </span>
                )}
              </label>
              <div className="relative">
                <select
                  value={dispatchRecyclerId}
                  onChange={(e) => setDispatchRecyclerId(e.target.value)}
                  disabled={loadingRecyclers || isDispatching}
                  className="w-full appearance-none bg-white border-2 border-stone-300 hover:border-stone-400 focus:border-blue-600 focus:ring-1 focus:ring-blue-600 text-stone-900 rounded-xl px-4 py-3.5 text-sm font-medium outline-none transition-all cursor-pointer disabled:opacity-60"
                >
                  {recyclers.map((r) => (
                    <option key={r.id} value={r.id} className="bg-white">
                      {r.name} — {r.location}
                    </option>
                  ))}
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-stone-400">
                  <ChevronDown className="h-4 w-4" />
                </div>
              </div>
            </div>

            {/* Material + Weight side-by-side */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-stone-700">Material</label>
                <div className="relative">
                  <select
                    value={dispatchMaterial}
                    onChange={(e) => setDispatchMaterial(e.target.value as MaterialCode)}
                    disabled={isDispatching}
                    className="w-full appearance-none bg-white border-2 border-stone-300 hover:border-stone-400 focus:border-blue-600 text-stone-900 rounded-xl px-4 py-3.5 text-sm font-medium outline-none transition-all cursor-pointer disabled:opacity-60"
                  >
                    <option value="COPPER">Copper</option>
                    <option value="ALUMINUM">Aluminum</option>
                    <option value="EWASTE">E-Waste</option>
                  </select>
                  <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-stone-400">
                    <ChevronDown className="h-4 w-4" />
                  </div>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-stone-700">Batch Weight (kg)</label>
                <div className="relative">
                  <Input
                    type="number"
                    step="0.1"
                    min="0.1"
                    placeholder="0.0"
                    value={dispatchWeight}
                    onChange={(e) => {
                      setDispatchWeight(e.target.value)
                      if (dispatchError) setDispatchError(null)
                    }}
                    disabled={isDispatching}
                    className="h-14 pl-4 pr-14 text-xl font-mono font-bold bg-white border-2 border-stone-300 focus-visible:border-blue-600 rounded-xl text-stone-900 placeholder:text-stone-400"
                  />
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 font-mono font-bold text-sm text-stone-600 bg-stone-100 px-2 py-1 rounded border border-stone-200 pointer-events-none">kg</div>
                </div>
              </div>
            </div>

            {/* Error */}
            {dispatchError && (
              <div className="flex items-center gap-2 p-3 rounded-xl bg-red-50 border border-red-200 text-red-800 text-sm">
                <AlertCircle className="h-4 w-4 shrink-0 text-red-500" />
                <span>{dispatchError}</span>
              </div>
            )}

            {/* Submit */}
            <Button
              type="submit"
              disabled={isDispatching || loadingRecyclers || !dispatchWeight}
              className="w-full h-14 text-base font-black tracking-wide uppercase rounded-2xl bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-40 shadow-sm transition-all active:scale-[0.99] border-0 gap-3"
            >
              {isDispatching ? (
                <><Loader2 className="h-5 w-5 animate-spin" /> Dispatching...</>
              ) : (
                <><Send className="h-5 w-5" /> Dispatch to Recycler</>
              )}
            </Button>
          </form>
        </div>
      </main>

      {/* Footer / Quick Reference */}
      <footer className="border-t border-stone-200 bg-white px-4 py-2.5 text-center text-xs text-stone-500">
        Tablet POS Terminal • Direct Weighing Scale Interface • Ministry of Mines (MoM) Critical Mineral Mission
      </footer>
    </div>
  )
}
