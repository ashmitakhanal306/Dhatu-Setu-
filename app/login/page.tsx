"use client"

import * as React from "react"
import { useState, useEffect, useRef, useCallback } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { supabase, type Facility } from "@/lib/supabase"
import { setSession, type UserRole } from "@/lib/session"
import {
  Scale,
  Building2,
  Factory,
  Warehouse,
  ArrowLeft,
  ShieldCheck,
  Loader2,
  CheckCircle2,
  ChevronDown,
  Recycle,
  ArrowRight,
  Lock,
  AlertCircle,
} from "lucide-react"

// ── Demo fallback facilities ──────────────────────────────────────────
const DEMO_FACILITIES: Facility[] = [
  { id: "agg-001", name: "Karol Bagh Scrap Aggregators", location: "Karol Bagh, New Delhi", type: "Aggregator", pin: "1234" },
  { id: "agg-002", name: "Dharavi Metal Co-op", location: "Dharavi, Mumbai", type: "Aggregator", pin: "1234" },
  { id: "rec-001", name: "Hindalco Primary Smelter", location: "Sriperumbudur, Tamil Nadu", type: "Formal Recycler", pin: "1234" },
  { id: "rec-002", name: "Gujarat Copper & Metals Ltd", location: "Dahej, Gujarat", type: "Formal Recycler", pin: "1234" },
  { id: "rec-003", name: "Hindustan Copper Smelting Complex", location: "Khetri, Rajasthan", type: "Formal Recycler", pin: "1234" },
]

// MoM is a fixed "facility"
const MOM_FACILITY: Facility = {
  id: "mom-001",
  name: "Ministry of Mines — CMTN Operations",
  location: "North Block, New Delhi",
  type: "Formal Recycler", // type doesn't matter for MoM
  pin: "1234",
}

type RoleOption = {
  id: UserRole
  label: string
  sublabel: string
  description: string
  icon: React.ElementType
  gradient: string
  ringColor: string
  badgeBg: string
  badgeText: string
  checkColor: string
  dbType: string | null
}

const ROLES: RoleOption[] = [
  {
    id: "Aggregator",
    label: "Aggregator",
    sublabel: "Collection Center",
    description: "Weigh scrap, pay collectors, dispatch verified batches.",
    icon: Warehouse,
    gradient: "from-emerald-500 to-teal-600",
    ringColor: "ring-emerald-500 border-emerald-400",
    badgeBg: "bg-emerald-100",
    badgeText: "text-emerald-800",
    checkColor: "text-emerald-600",
    dbType: "Aggregator",
  },
  {
    id: "Recycler",
    label: "Recycler",
    sublabel: "Formal Recycling Plant",
    description: "Verify and accept inbound consignments from godowns.",
    icon: Factory,
    gradient: "from-blue-500 to-indigo-600",
    ringColor: "ring-blue-500 border-blue-400",
    badgeBg: "bg-blue-100",
    badgeText: "text-blue-800",
    checkColor: "text-blue-600",
    dbType: "Formal Recycler",
  },
  {
    id: "MoM",
    label: "Ministry of Mines",
    sublabel: "Government Dashboard",
    description: "Monitor the full supply chain and compliance metrics.",
    icon: Building2,
    gradient: "from-amber-500 to-orange-600",
    ringColor: "ring-amber-500 border-amber-400",
    badgeBg: "bg-amber-100",
    badgeText: "text-amber-800",
    checkColor: "text-amber-600",
    dbType: null,
  },
]

// ── OTP 4-Digit Input Component ───────────────────────────────────────
interface DigitInputProps {
  value: string[]
  onChange: (v: string[]) => void
  hasError: boolean
  disabled: boolean
}

function DigitInput({ value, onChange, hasError, disabled }: DigitInputProps) {
  const refs = [
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
  ]

  const handleChange = (idx: number, raw: string) => {
    const digit = raw.replace(/\D/g, "").slice(-1)
    const next = [...value]
    next[idx] = digit
    onChange(next)
    if (digit && idx < 3) {
      refs[idx + 1].current?.focus()
    }
  }

  const handleKeyDown = (idx: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace") {
      if (value[idx]) {
        const next = [...value]
        next[idx] = ""
        onChange(next)
      } else if (idx > 0) {
        refs[idx - 1].current?.focus()
        const next = [...value]
        next[idx - 1] = ""
        onChange(next)
      }
    } else if (e.key === "ArrowLeft" && idx > 0) {
      refs[idx - 1].current?.focus()
    } else if (e.key === "ArrowRight" && idx < 3) {
      refs[idx + 1].current?.focus()
    }
  }

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault()
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 4)
    if (!pasted) return
    const next = ["", "", "", ""]
    for (let i = 0; i < 4; i++) {
      next[i] = pasted[i] || ""
    }
    onChange(next)
    const lastFilled = Math.min(pasted.length - 1, 3)
    refs[lastFilled].current?.focus()
  }

  return (
    <div className="flex items-center justify-center gap-3" onPaste={handlePaste}>
      {[0, 1, 2, 3].map((idx) => (
        <input
          key={idx}
          ref={refs[idx]}
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          maxLength={1}
          value={value[idx]}
          onChange={(e) => handleChange(idx, e.target.value)}
          onKeyDown={(e) => handleKeyDown(idx, e)}
          onFocus={(e) => e.target.select()}
          disabled={disabled}
          aria-label={`Digit ${idx + 1}`}
          className={`digit-box ${value[idx] ? "filled" : ""} ${hasError ? "error" : ""} disabled:opacity-50 disabled:cursor-not-allowed`}
        />
      ))}
    </div>
  )
}

// ── Main Login Page ───────────────────────────────────────────────────
export default function LoginPage() {
  const router = useRouter()
  const [selectedRole, setSelectedRole] = useState<UserRole>("Aggregator")
  const [facilities, setFacilities] = useState<Facility[]>([])
  const [selectedFacilityId, setSelectedFacilityId] = useState<string>("")
  const [digits, setDigits] = useState<string[]>(["", "", "", ""])
  const [loadingFacilities, setLoadingFacilities] = useState<boolean>(true)
  const [submitting, setSubmitting] = useState<boolean>(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [hasDigitError, setHasDigitError] = useState<boolean>(false)

  const currentRole = ROLES.find((r) => r.id === selectedRole)!
  const isMoM = selectedRole === "MoM"

  // ── Load facilities for chosen role ──────────────────────────────────
  useEffect(() => {
    let isMounted = true
    setLoadingFacilities(true)
    setErrorMessage(null)
    setDigits(["", "", "", ""])
    setHasDigitError(false)

    if (isMoM) {
      setFacilities([MOM_FACILITY])
      setSelectedFacilityId(MOM_FACILITY.id)
      setLoadingFacilities(false)
      return
    }

    const dbType = selectedRole === "Aggregator" ? "Aggregator" : "Formal Recycler"

    async function load() {
      try {
        const { data, error } = await supabase
          .from("facilities")
          .select("id, name, location, type, pin")
          .eq("type", dbType)
          .order("name")
        if (!error && data && data.length > 0) {
          if (isMounted) {
            setFacilities(data as Facility[])
            setSelectedFacilityId((data as Facility[])[0].id)
          }
        } else {
          throw new Error("fallback")
        }
      } catch {
        const fb = DEMO_FACILITIES.filter((f) => f.type === dbType)
        if (isMounted) {
          setFacilities(fb)
          setSelectedFacilityId(fb[0]?.id ?? "")
        }
      } finally {
        if (isMounted) setLoadingFacilities(false)
      }
    }

    load()
    return () => { isMounted = false }
  }, [selectedRole, isMoM])

  // ── Handle login ──────────────────────────────────────────────────────
  const handleLogin = useCallback(async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMessage(null)
    setHasDigitError(false)

    const code = digits.join("")

    if (!selectedFacilityId) {
      setErrorMessage("Please select a facility.")
      return
    }
    if (code.length < 4) {
      setErrorMessage("Enter all 4 digits of your access code.")
      setHasDigitError(true)
      return
    }

    setSubmitting(true)

    try {
      let facilityMatch: Facility | undefined

      if (isMoM) {
        facilityMatch = MOM_FACILITY
      } else {
        // Try Supabase first
        try {
          const { data, error } = await supabase
            .from("facilities")
            .select("*")
            .eq("id", selectedFacilityId)
            .maybeSingle()
          if (!error && data) facilityMatch = data as Facility
        } catch { /* fallback */ }

        if (!facilityMatch) {
          facilityMatch = [...DEMO_FACILITIES, MOM_FACILITY].find((f) => f.id === selectedFacilityId)
        }
      }

      if (!facilityMatch) {
        setErrorMessage("Facility not found. Please try again.")
        setSubmitting(false)
        return
      }

      const expected = facilityMatch.pin || "1234"
      if (code !== expected) {
        setErrorMessage("Incorrect access code. (Demo default: 1234)")
        setHasDigitError(true)
        setDigits(["", "", "", ""])
        setSubmitting(false)
        return
      }

      setSession({
        facilityId: facilityMatch.id,
        facilityName: facilityMatch.name,
        role: selectedRole,
      })

      if (selectedRole === "Aggregator") router.push("/pos")
      else if (selectedRole === "Recycler") router.push("/recycler")
      else router.push("/dashboard")

    } catch {
      setErrorMessage("Authentication error. Please try again.")
      setSubmitting(false)
    }
  }, [digits, selectedFacilityId, selectedRole, isMoM, router])

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <header className="border-b border-slate-200 bg-white/95 backdrop-blur sticky top-0 z-30 px-4 py-3.5">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 transition-colors p-1.5 rounded-lg hover:bg-slate-100"
            >
              <ArrowLeft className="h-4 w-4" />
              <span className="font-medium">Back</span>
            </Link>
            <div className="h-4 w-px bg-slate-300" />
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-emerald-600 to-teal-700">
                <Recycle className="h-4 w-4 text-white" />
              </div>
              <span className="font-black text-slate-900 tracking-tight">
                Dhatu<span className="text-emerald-600">Setu</span>
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-500 bg-slate-100 border border-slate-200 px-3 py-1.5 rounded-full">
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
            <span className="font-medium">Secure Terminal Access</span>
          </div>
        </div>
      </header>

      {/* ── Main ───────────────────────────────────────────────────────── */}
      <main className="flex-1 flex items-center justify-center p-4 py-10">
        <div className="w-full max-w-3xl space-y-8">

          {/* Title */}
          <div className="text-center space-y-2">
            <div className="inline-flex items-center gap-2 rounded-full bg-emerald-50 border border-emerald-200 px-4 py-1.5 text-xs font-bold text-emerald-700 uppercase tracking-wider mb-1">
              <Lock className="h-3.5 w-3.5" /> Role-Based Access
            </div>
            <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-slate-900">
              Select your role
            </h1>
            <p className="text-slate-500 text-base max-w-md mx-auto">
              Choose your role below, select your facility, and enter your 4-digit access code.
            </p>
          </div>

          {/* ── Role Cards ─────────────────────────────────────────────── */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {ROLES.map((role) => {
              const Icon = role.icon
              const isSelected = selectedRole === role.id
              return (
                <button
                  key={role.id}
                  type="button"
                  onClick={() => {
                    setSelectedRole(role.id)
                    setErrorMessage(null)
                  }}
                  className={`relative w-full text-left p-5 rounded-2xl border-2 transition-all duration-200 outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-emerald-500 ${
                    isSelected
                      ? `bg-white ring-2 ${role.ringColor} shadow-lg`
                      : "bg-white border-slate-200 hover:border-slate-300 hover:shadow-md"
                  }`}
                >
                  {isSelected && (
                    <div className="absolute top-3 right-3">
                      <CheckCircle2 className={`h-5 w-5 ${role.checkColor}`} />
                    </div>
                  )}
                  <div className={`h-11 w-11 rounded-xl bg-gradient-to-br ${role.gradient} flex items-center justify-center shadow-md mb-3.5`}>
                    <Icon className="h-5 w-5 text-white" />
                  </div>
                  <div className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider mb-2 ${role.badgeBg} ${role.badgeText}`}>
                    {role.label}
                  </div>
                  <h3 className="font-black text-slate-900 text-sm">{role.sublabel}</h3>
                  <p className="text-xs text-slate-500 mt-1 leading-relaxed">{role.description}</p>
                </button>
              )
            })}
          </div>

          {/* ── Auth Form Card ──────────────────────────────────────────── */}
          <div className="bg-white rounded-3xl border border-slate-200 shadow-xl overflow-hidden animate-scale-in">
            {/* Top gradient bar */}
            <div className={`h-1.5 w-full bg-gradient-to-r ${currentRole.gradient}`} />

            <form onSubmit={handleLogin} className="p-6 sm:p-8 space-y-7">
              {/* Facility Select */}
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-widest text-slate-600 flex items-center justify-between">
                  <span>
                    {isMoM ? "Ministry Division" : selectedRole === "Aggregator" ? "Select Collection Center" : "Select Recycling Plant"}
                  </span>
                  {loadingFacilities && !isMoM && (
                    <span className="flex items-center gap-1.5 text-[11px] text-slate-400 normal-case font-normal">
                      <Loader2 className="h-3 w-3 animate-spin" /> Loading...
                    </span>
                  )}
                </label>
                <div className="relative">
                  <select
                    value={selectedFacilityId}
                    onChange={(e) => setSelectedFacilityId(e.target.value)}
                    disabled={loadingFacilities || submitting || isMoM}
                    className="w-full appearance-none bg-slate-50 border-2 border-slate-200 hover:border-slate-300 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 text-slate-900 rounded-xl px-4 py-3.5 text-sm font-medium outline-none transition-all cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {facilities.map((fac) => (
                      <option key={fac.id} value={fac.id} className="bg-white text-slate-900">
                        {fac.name} — {fac.location}
                      </option>
                    ))}
                  </select>
                  {!isMoM && (
                    <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-slate-400">
                      <ChevronDown className="h-4 w-4" />
                    </div>
                  )}
                </div>
              </div>

              {/* 4-Digit Code */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold uppercase tracking-widest text-slate-600 flex items-center gap-2">
                    <Lock className="h-3.5 w-3.5 text-slate-400" />
                    4-Digit Access Code
                  </label>
                  <span className="text-xs text-slate-400 font-mono bg-slate-100 px-2.5 py-1 rounded-lg border border-slate-200">
                    Demo: 1234
                  </span>
                </div>

                <DigitInput
                  value={digits}
                  onChange={(v) => {
                    setDigits(v)
                    if (errorMessage) {
                      setErrorMessage(null)
                      setHasDigitError(false)
                    }
                  }}
                  hasError={hasDigitError}
                  disabled={submitting}
                />

                <p className="text-center text-xs text-slate-400">
                  Enter the 4-digit PIN for your facility · Use keyboard or paste
                </p>
              </div>

              {/* Error */}
              {errorMessage && (
                <div className="flex items-start gap-3 p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-800 text-sm animate-fade-in">
                  <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-red-500" />
                  <span>{errorMessage}</span>
                </div>
              )}

              {/* Submit */}
              <button
                type="submit"
                disabled={submitting || loadingFacilities || digits.join("").length < 4}
                className={`w-full flex items-center justify-center gap-2.5 h-14 rounded-xl font-bold text-base text-white bg-gradient-to-r ${currentRole.gradient} shadow-lg hover:shadow-xl transition-all duration-200 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none`}
              >
                {submitting ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin" />
                    <span>Authenticating...</span>
                  </>
                ) : (
                  <>
                    <span>
                      {selectedRole === "MoM"
                        ? "Access MoM Dashboard"
                        : `Enter ${currentRole.sublabel}`}
                    </span>
                    <ArrowRight className="h-5 w-5" />
                  </>
                )}
              </button>
            </form>
          </div>

          {/* Footer hint */}
          <p className="text-center text-xs text-slate-400">
            Each role has a dedicated terminal. All access is logged and audited.{" "}
            <Link href="/dashboard" className="text-emerald-600 hover:underline font-medium">
              View public dashboard
            </Link>
          </p>
        </div>
      </main>

      {/* ── Footer ─────────────────────────────────────────────────────── */}
      <footer className="border-t border-slate-200 bg-white px-4 py-4 text-center text-xs text-slate-500">
        Ministry of Mines (MoM) · Critical Mineral Traceability Network · Secure Role-Based Access · Demo PIN: 1234
      </footer>
    </div>
  )
}
