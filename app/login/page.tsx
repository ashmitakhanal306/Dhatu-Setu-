"use client"

import * as React from "react"
import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { supabase, type Facility } from "@/lib/supabase"
import { setSession, type UserRole } from "@/lib/session"
import {
  Scale,
  Building2,
  Lock,
  ArrowRight,
  ArrowLeft,
  ShieldCheck,
  AlertCircle,
  Loader2,
  CheckCircle2,
} from "lucide-react"

// Built-in demo fallback in case Supabase schema migration is pending
const DEMO_FACILITIES: Facility[] = [
  {
    id: "agg-001",
    name: "Delhi Central Godown",
    location: "Karol Bagh, New Delhi",
    type: "Aggregator",
    pin: "1234",
  },
  {
    id: "agg-002",
    name: "Mumbai West Scrap Yard",
    location: "Dharavi, Mumbai",
    type: "Aggregator",
    pin: "1234",
  },
  {
    id: "rec-001",
    name: "National E-Waste Corp",
    location: "Sriperumbudur, Tamil Nadu",
    type: "Formal Recycler",
    pin: "1234",
  },
  {
    id: "rec-002",
    name: "Hindalco Metals",
    location: "Dahej, Gujarat",
    type: "Formal Recycler",
    pin: "1234",
  },
  {
    id: "rec-003",
    name: "Bharat Copper Ltd",
    location: "Khetri, Rajasthan",
    type: "Formal Recycler",
    pin: "1234",
  },
]

export default function LoginPage() {
  const router = useRouter()
  const [selectedRole, setSelectedRole] = useState<UserRole>("Aggregator")
  const [facilities, setFacilities] = useState<Facility[]>([])
  const [selectedFacilityId, setSelectedFacilityId] = useState<string>("")
  const [pin, setPin] = useState<string>("")
  const [loadingFacilities, setLoadingFacilities] = useState<boolean>(true)
  const [submitting, setSubmitting] = useState<boolean>(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  // Fetch facilities matching the selected role
  useEffect(() => {
    let isMounted = true
    async function loadFacilities() {
      setLoadingFacilities(true)
      setErrorMessage(null)
      const targetType = selectedRole === "Aggregator" ? "Aggregator" : "Formal Recycler"

      try {
        const { data, error } = await supabase
          .from("facilities")
          .select("*")
          .eq("type", targetType)
          .order("name", { ascending: true })

        if (error || !data || data.length === 0) {
          // Fallback to local demo facilities matching the role
          const filteredFallback = DEMO_FACILITIES.filter((f) => f.type === targetType)
          if (isMounted) {
            setFacilities(filteredFallback)
            if (filteredFallback.length > 0) {
              setSelectedFacilityId(filteredFallback[0].id)
            }
          }
        } else {
          if (isMounted) {
            setFacilities(data as Facility[])
            if (data.length > 0) {
              setSelectedFacilityId(data[0].id)
            }
          }
        }
      } catch {
        const filteredFallback = DEMO_FACILITIES.filter((f) => f.type === targetType)
        if (isMounted) {
          setFacilities(filteredFallback)
          if (filteredFallback.length > 0) {
            setSelectedFacilityId(filteredFallback[0].id)
          }
        }
      } finally {
        if (isMounted) setLoadingFacilities(false)
      }
    }

    loadFacilities()
    return () => {
      isMounted = false
    }
  }, [selectedRole])

  const handleRoleChange = (role: UserRole) => {
    setSelectedRole(role)
    setPin("")
    setErrorMessage(null)
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMessage(null)

    if (!selectedFacilityId) {
      setErrorMessage("Please select a facility.")
      return
    }

    if (!pin || pin.length < 4) {
      setErrorMessage("Please enter a 4-digit security PIN.")
      return
    }

    setSubmitting(true)

    try {
      // Query Supabase for selected facility
      let facilityMatch: Facility | undefined

      try {
        const { data, error } = await supabase
          .from("facilities")
          .select("*")
          .eq("id", selectedFacilityId)
          .maybeSingle()

        if (!error && data) {
          facilityMatch = data as Facility
        }
      } catch {
        // Fall through to local demo check
      }

      // If Supabase table isn't accessible yet, check DEMO_FACILITIES
      if (!facilityMatch) {
        facilityMatch = DEMO_FACILITIES.find((f) => f.id === selectedFacilityId)
      }

      if (!facilityMatch) {
        setErrorMessage("Facility not found. Please select a valid facility.")
        setSubmitting(false)
        return
      }

      // Compare entered PIN (default demo PIN is '1234')
      const expectedPin = facilityMatch.pin || "1234"
      if (pin !== expectedPin) {
        setErrorMessage("Invalid 4-digit PIN. (Demo default is 1234)")
        setSubmitting(false)
        return
      }

      // Store in localStorage
      setSession({
        facilityId: facilityMatch.id,
        facilityName: facilityMatch.name,
        role: selectedRole,
      })

      // Redirect based on role
      if (selectedRole === "Aggregator") {
        router.replace("/pos")
      } else {
        router.replace("/recycler")
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Authentication error occurred"
      setErrorMessage(msg)
      setSubmitting(false)
    }
  }

  const isAggregator = selectedRole === "Aggregator"

  return (
    <div className="min-h-screen bg-stone-50 text-stone-900 flex flex-col justify-between select-none">
      {/* Top Bar Navigation */}
      <header className="border-b border-stone-200 bg-white/90 backdrop-blur px-4 py-3 sm:px-6">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 text-xs text-stone-500 hover:text-stone-800 transition-colors p-1.5 rounded-md hover:bg-stone-100"
            >
              <ArrowLeft className="h-4 w-4" />
              <span>Back to Hub</span>
            </Link>
            <div className="h-4 w-px bg-stone-300" />
            <span className="text-xs uppercase tracking-widest font-semibold text-green-800 flex items-center gap-1.5">
              <ShieldCheck className="h-4 w-4 text-green-700" />
              Dhatu Setu • Terminal Auth
            </span>
          </div>

          <div className="text-xs text-stone-500 hidden sm:flex items-center gap-2">
            <span>Ministry of Mines</span>
            <span className="text-stone-300">•</span>
            <span className="font-mono text-stone-700">CMTN Secure Login</span>
          </div>
        </div>
      </header>

      {/* Main Login Form Container */}
      <main className="flex-1 max-w-xl w-full mx-auto p-4 sm:p-6 lg:p-8 flex flex-col justify-center">
        <div className="space-y-6">
          {/* Heading */}
          <div className="text-center space-y-2">
            <div className="inline-flex items-center gap-2 rounded-full border border-green-200 bg-green-50 px-3 py-1 text-xs font-semibold tracking-wider text-green-800 uppercase">
              Role-Based Terminal Access
            </div>
            <h1 className="text-3xl font-extrabold tracking-tight text-stone-900">
              Select Your Facility
            </h1>
            <p className="text-sm text-stone-500">
              Choose your role and enter your 4-digit facility security PIN to access your terminal.
            </p>
          </div>

          {/* 1. Large Tappable Role Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Aggregator Card */}
            <div
              role="button"
              tabIndex={0}
              onClick={() => handleRoleChange("Aggregator")}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") handleRoleChange("Aggregator")
              }}
              className={`cursor-pointer transition-all duration-200 rounded-xl border p-5 flex flex-col justify-between gap-3 text-left outline-none ${
                isAggregator
                  ? "border-green-600 bg-green-50/80 ring-2 ring-green-500 shadow-sm"
                  : "border-stone-200 bg-white hover:border-stone-300 hover:bg-stone-50 text-stone-500 shadow-sm"
              }`}
            >
              <div className="flex items-center justify-between">
                <div
                  className={`p-2.5 rounded-lg border ${
                    isAggregator
                      ? "bg-green-100 border-green-300 text-green-800"
                      : "bg-stone-100 border-stone-200 text-stone-500"
                  }`}
                >
                  <Scale className="h-6 w-6" />
                </div>
                {isAggregator && (
                  <CheckCircle2 className="h-5 w-5 text-green-700" />
                )}
              </div>
              <div>
                <h3
                  className={`text-lg font-bold tracking-tight ${
                    isAggregator ? "text-green-900" : "text-stone-800"
                  }`}
                >
                  Aggregator
                </h3>
                <p className="text-xs text-stone-500 mt-1 leading-relaxed">
                  Godown intake POS scale terminal, Kabadiwala DBT registration, and dispatch batching.
                </p>
              </div>
              <div className="text-[11px] font-mono uppercase tracking-wider text-green-800 font-semibold">
                Access: /pos &amp; /inventory
              </div>
            </div>

            {/* Recycler Card */}
            <div
              role="button"
              tabIndex={0}
              onClick={() => handleRoleChange("Recycler")}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") handleRoleChange("Recycler")
              }}
              className={`cursor-pointer transition-all duration-200 rounded-xl border p-5 flex flex-col justify-between gap-3 text-left outline-none ${
                !isAggregator
                  ? "border-blue-600 bg-blue-50/80 ring-2 ring-blue-500 shadow-sm"
                  : "border-stone-200 bg-white hover:border-stone-300 hover:bg-stone-50 text-stone-500 shadow-sm"
              }`}
            >
              <div className="flex items-center justify-between">
                <div
                  className={`p-2.5 rounded-lg border ${
                    !isAggregator
                      ? "bg-blue-100 border-blue-300 text-blue-800"
                      : "bg-stone-100 border-stone-200 text-stone-500"
                  }`}
                >
                  <Building2 className="h-6 w-6" />
                </div>
                {!isAggregator && (
                  <CheckCircle2 className="h-5 w-5 text-blue-600" />
                )}
              </div>
              <div>
                <h3
                  className={`text-lg font-bold tracking-tight ${
                    !isAggregator ? "text-blue-900" : "text-stone-800"
                  }`}
                >
                  Recycler
                </h3>
                <p className="text-xs text-stone-500 mt-1 leading-relaxed">
                  Inbound dispatch verification, formal smelter acceptance, and processing ledger.
                </p>
              </div>
              <div className="text-[11px] font-mono uppercase tracking-wider text-blue-800 font-semibold">
                Access: /recycler
              </div>
            </div>
          </div>

          {/* 2. Form: Facility Dropdown & 4-Digit PIN */}
          <Card className="border-stone-200 bg-white shadow-md">
            <CardContent className="p-6 space-y-5">
              <form onSubmit={handleLogin} className="space-y-4">
                {/* Facility Selection */}
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-stone-700 uppercase tracking-wider flex items-center justify-between">
                    <span>Select {isAggregator ? "Aggregator Godown" : "Recycling Facility"}</span>
                    {loadingFacilities && (
                      <span className="flex items-center gap-1 text-[11px] text-stone-500">
                        <Loader2 className="h-3 w-3 animate-spin" /> Loading facilities...
                      </span>
                    )}
                  </label>

                  <div className="relative">
                    <select
                      value={selectedFacilityId}
                      onChange={(e) => setSelectedFacilityId(e.target.value)}
                      disabled={loadingFacilities || submitting}
                      className="w-full bg-white border border-stone-300 hover:border-stone-400 focus:border-green-600 focus:ring-1 focus:ring-green-600 text-stone-900 rounded-lg px-3.5 py-3 text-sm font-medium outline-none transition-colors appearance-none cursor-pointer disabled:opacity-50"
                    >
                      {facilities.map((fac) => (
                        <option key={fac.id} value={fac.id} className="bg-white text-stone-900 py-1">
                          {fac.name} — {fac.location} (ID: {fac.id})
                        </option>
                      ))}
                    </select>
                    <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3.5 text-stone-400">
                      <svg className="h-4 w-4 fill-current" viewBox="0 0 20 20">
                        <path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" />
                      </svg>
                    </div>
                  </div>
                </div>

                {/* 4-digit PIN */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-stone-700 uppercase tracking-wider flex items-center gap-1.5">
                      <Lock className="h-3.5 w-3.5 text-stone-400" />
                      <span>Security PIN</span>
                    </label>
                    <span className="text-[11px] text-stone-500 font-mono">
                      Demo PIN: 1234
                    </span>
                  </div>
                  <Input
                    type="password"
                    maxLength={4}
                    inputMode="numeric"
                    pattern="[0-9]*"
                    placeholder="••••"
                    value={pin}
                    onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
                    disabled={submitting}
                    className="h-12 text-center font-mono text-2xl tracking-[0.4em] bg-white border-stone-300 text-stone-900 focus-visible:ring-green-600 focus-visible:border-green-600 placeholder:tracking-normal placeholder:text-sm placeholder:font-sans placeholder:text-stone-400"
                  />
                </div>

                {/* Inline Error Message */}
                {errorMessage && (
                  <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-800 text-xs flex items-start gap-2 animate-in fade-in duration-200">
                    <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-red-600" />
                    <span>{errorMessage}</span>
                  </div>
                )}

                {/* Submit Button */}
                <Button
                  type="submit"
                  disabled={submitting || loadingFacilities}
                  className={`w-full h-12 text-sm font-bold text-white transition-colors shadow-sm gap-2 mt-2 ${
                    isAggregator
                      ? "bg-green-700 hover:bg-green-800"
                      : "bg-blue-600 hover:bg-blue-700"
                  }`}
                >
                  {submitting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>Authenticating...</span>
                    </>
                  ) : (
                    <>
                      <span>Enter {selectedRole} Terminal</span>
                      <ArrowRight className="h-4 w-4" />
                    </>
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-stone-200 bg-white px-4 py-3 text-center text-xs text-stone-500">
        Ministry of Mines (MoM) • Critical Mineral Traceability Network • Demo PIN is 1234
      </footer>
    </div>
  )
}
