"use client"

import * as React from "react"
import { useState, useEffect } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"
import { setSession, getSession, type UserRole } from "@/lib/session"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"
import {
  Scale,
  Factory,
  Warehouse,
  Recycle,
  CheckCircle2,
  Banknote,
  FileCheck,
  Globe,
  Loader2,
  ArrowRight,
  ShieldCheck,
  ChevronDown,
} from "lucide-react"

interface Facility {
  id: string
  name: string
  location: string
  type: "Aggregator" | "Formal Recycler"
  pin?: string
}

const DEMO_FACILITIES: Facility[] = [
  {
    id: "agg-001",
    name: "Karol Bagh Scrap Aggregators",
    location: "Karol Bagh, New Delhi",
    type: "Aggregator",
    pin: "1234",
  },
  {
    id: "agg-002",
    name: "Dharavi Metal Co-op",
    location: "Dharavi, Mumbai",
    type: "Aggregator",
    pin: "1234",
  },
  {
    id: "rec-001",
    name: "Hindalco Primary Smelter",
    location: "Sriperumbudur, Tamil Nadu",
    type: "Formal Recycler",
    pin: "1234",
  },
  {
    id: "rec-002",
    name: "Gujarat Copper & Metals Ltd",
    location: "Dahej, Gujarat",
    type: "Formal Recycler",
    pin: "1234",
  },
  {
    id: "rec-003",
    name: "Hindustan Copper Smelting Complex",
    location: "Khetri, Rajasthan",
    type: "Formal Recycler",
    pin: "1234",
  },
]

export default function HomePage() {
  const router = useRouter()
  const [selectedRole, setSelectedRole] = useState<UserRole | null>("Aggregator")
  const [facilities, setFacilities] = useState<Facility[]>([])
  const [loadingFacilities, setLoadingFacilities] = useState<boolean>(true)
  const [selectedFacilityId, setSelectedFacilityId] = useState<string>("")
  const [code, setCode] = useState<string>("")
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState<boolean>(false)

  // Fetch facilities for the chosen role
  useEffect(() => {
    if (!selectedRole) return

    let isMounted = true
    setLoadingFacilities(true)
    setErrorMessage(null)

    async function loadFacilities() {
      const dbType = selectedRole === "Aggregator" ? "Aggregator" : "Formal Recycler"

      try {
        const { data, error } = await supabase
          .from("facilities")
          .select("id, name, location, type, pin")
          .eq("type", dbType)
          .order("name")

        if (!error && data && data.length > 0) {
          if (isMounted) {
            setFacilities(data as Facility[])
            setSelectedFacilityId(data[0].id)
          }
        } else {
          const filteredFallback = DEMO_FACILITIES.filter((f) => f.type === dbType)
          if (isMounted) {
            setFacilities(filteredFallback)
            setSelectedFacilityId(filteredFallback[0].id)
          }
        }
      } catch {
        const filteredFallback = DEMO_FACILITIES.filter((f) => f.type === dbType)
        if (isMounted) {
          setFacilities(filteredFallback)
          setSelectedFacilityId(filteredFallback[0].id)
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

  const handleRoleClick = (role: UserRole) => {
    setSelectedRole(role)
    setCode("")
    setErrorMessage(null)
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMessage(null)

    if (!selectedRole) {
      setErrorMessage("Please select a center or plant.")
      return
    }

    if (!selectedFacilityId) {
      setErrorMessage("Please select your facility.")
      return
    }

    if (!code || code.length < 4) {
      setErrorMessage("Please enter your 4-digit code.")
      return
    }

    setSubmitting(true)

    try {
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
        // Fall back to local list
      }

      if (!facilityMatch) {
        facilityMatch = facilities.find((f) => f.id === selectedFacilityId)
      }

      if (!facilityMatch) {
        setErrorMessage("Facility not found, try again.")
        setSubmitting(false)
        return
      }

      const expectedPin = facilityMatch.pin || "1234"
      if (code !== expectedPin) {
        setErrorMessage("That code doesn't match, try again.")
        setSubmitting(false)
        return
      }

      // Save session in localStorage
      setSession({
        facilityId: facilityMatch.id,
        facilityName: facilityMatch.name,
        role: selectedRole,
      })

      // Redirect directly to destination
      if (selectedRole === "Aggregator") {
        router.push("/pos")
      } else {
        router.push("/recycler")
      }
    } catch {
      setErrorMessage("That code doesn't match, try again.")
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-stone-50 text-stone-900 flex flex-col font-sans">
      {/* 1. Simple Header */}
      <header className="border-b border-stone-200 bg-white/95 backdrop-blur sticky top-0 z-30 px-4 py-3.5 sm:px-8">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="text-xl font-black tracking-tight text-stone-900">
              Dhatu Setu
            </span>
            <span className="text-xs text-stone-600 bg-stone-100 border border-stone-200 px-2.5 py-0.5 rounded-full font-medium">
              Ministry of Mines
            </span>
          </div>

          <Link
            href="/dashboard"
            className="text-xs text-stone-500 hover:text-stone-900 font-medium flex items-center gap-1 transition-colors"
          >
            <span>Official Dashboard</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-3xl w-full mx-auto px-4 py-8 sm:py-12 flex flex-col justify-center gap-8">
        {/* 2. Hero Section (Plain language, two sentences total) */}
        <section className="text-center space-y-3">
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight text-stone-900 leading-tight">
            Turn scrap into instant payment — and an official record.
          </h1>
          <p className="text-base sm:text-lg text-stone-600 max-w-2xl mx-auto leading-relaxed">
            Weigh it, log it, get paid. Every kilo counts towards your digital income history.
          </p>
        </section>

        {/* 3. Role Selection Cards + Inline Expansion */}
        <section className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Card 1: Collection Center */}
            <div
              role="button"
              tabIndex={0}
              onClick={() => handleRoleClick("Aggregator")}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") handleRoleClick("Aggregator")
              }}
              className={`cursor-pointer transition-all duration-200 rounded-xl border p-5 flex flex-col justify-between gap-3 text-left outline-none ${
                selectedRole === "Aggregator"
                  ? "border-green-700 bg-green-50/80 ring-2 ring-green-600 shadow-sm"
                  : "border-stone-200 bg-white hover:border-stone-300 hover:bg-stone-50 text-stone-600 shadow-sm"
              }`}
            >
              <div className="flex items-center justify-between">
                <div
                  className={`p-2.5 rounded-lg border ${
                    selectedRole === "Aggregator"
                      ? "bg-green-100 border-green-300 text-green-800"
                      : "bg-stone-100 border-stone-200 text-stone-600"
                  }`}
                >
                  <Warehouse className="h-6 w-6" />
                </div>
                {selectedRole === "Aggregator" && (
                  <CheckCircle2 className="h-5 w-5 text-green-700" />
                )}
              </div>
              <div>
                <h3 className="text-base sm:text-lg font-bold text-stone-900">
                  I run a Collection Center
                </h3>
                <p className="text-xs sm:text-sm text-stone-500 mt-1 leading-relaxed">
                  Weigh scrap, pay collectors, send it to a recycler.
                </p>
              </div>
            </div>

            {/* Card 2: Recycling Plant */}
            <div
              role="button"
              tabIndex={0}
              onClick={() => handleRoleClick("Recycler")}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") handleRoleClick("Recycler")
              }}
              className={`cursor-pointer transition-all duration-200 rounded-xl border p-5 flex flex-col justify-between gap-3 text-left outline-none ${
                selectedRole === "Recycler"
                  ? "border-green-700 bg-green-50/80 ring-2 ring-green-600 shadow-sm"
                  : "border-stone-200 bg-white hover:border-stone-300 hover:bg-stone-50 text-stone-600 shadow-sm"
              }`}
            >
              <div className="flex items-center justify-between">
                <div
                  className={`p-2.5 rounded-lg border ${
                    selectedRole === "Recycler"
                      ? "bg-green-100 border-green-300 text-green-800"
                      : "bg-stone-100 border-stone-200 text-stone-600"
                  }`}
                >
                  <Factory className="h-6 w-6" />
                </div>
                {selectedRole === "Recycler" && (
                  <CheckCircle2 className="h-5 w-5 text-green-700" />
                )}
              </div>
              <div>
                <h3 className="text-base sm:text-lg font-bold text-stone-900">
                  I run a Recycling Plant
                </h3>
                <p className="text-xs sm:text-sm text-stone-500 mt-1 leading-relaxed">
                  Receive and confirm scrap shipments.
                </p>
              </div>
            </div>
          </div>

          {/* Inline Expanded Access Form */}
          {selectedRole && (
            <Card className="border-stone-200 bg-white shadow-sm overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
              <CardContent className="p-5 sm:p-6">
                <form onSubmit={handleLogin} className="space-y-4">
                  {/* Facility Dropdown */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-stone-700 uppercase tracking-wider flex items-center justify-between">
                      <span>
                        {selectedRole === "Aggregator"
                          ? "Select your Collection Center"
                          : "Select your Recycling Plant"}
                      </span>
                      {loadingFacilities && (
                        <span className="flex items-center gap-1 text-[11px] text-stone-500 font-normal">
                          <Loader2 className="h-3 w-3 animate-spin" /> Loading...
                        </span>
                      )}
                    </label>

                    <div className="relative">
                      <select
                        value={selectedFacilityId}
                        onChange={(e) => setSelectedFacilityId(e.target.value)}
                        disabled={loadingFacilities || submitting}
                        className="w-full bg-white border border-stone-300 hover:border-stone-400 focus:border-green-700 focus:ring-1 focus:ring-green-700 text-stone-900 rounded-lg px-3.5 py-3 text-sm font-medium outline-none transition-colors appearance-none cursor-pointer disabled:opacity-50"
                      >
                        {facilities.map((fac) => (
                          <option key={fac.id} value={fac.id} className="bg-white text-stone-900 py-1">
                            {fac.name} — {fac.location}
                          </option>
                        ))}
                      </select>
                      <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3.5 text-stone-500">
                        <ChevronDown className="h-4 w-4" />
                      </div>
                    </div>
                  </div>

                  {/* 4-digit code Input */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold text-stone-700 uppercase tracking-wider">
                        4-digit code
                      </label>
                      <span className="text-xs text-stone-400 font-mono">
                        Demo code is 1234
                      </span>
                    </div>
                    <Input
                      type="password"
                      maxLength={4}
                      inputMode="numeric"
                      pattern="[0-9]*"
                      placeholder="••••"
                      value={code}
                      onChange={(e) => {
                        setCode(e.target.value.replace(/\D/g, "").slice(0, 4))
                        if (errorMessage) setErrorMessage(null)
                      }}
                      disabled={submitting}
                      className="h-12 text-center font-mono text-2xl tracking-[0.4em] bg-white border-stone-300 text-stone-900 focus-visible:ring-green-700 focus-visible:border-green-700 placeholder:tracking-normal placeholder:text-sm placeholder:font-sans placeholder:text-stone-400 rounded-lg"
                    />
                  </div>

                  {/* Inline Error Message */}
                  {errorMessage && (
                    <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-800 text-xs font-medium animate-in fade-in duration-200">
                      {errorMessage}
                    </div>
                  )}

                  {/* Continue Button */}
                  <Button
                    type="submit"
                    disabled={submitting || loadingFacilities}
                    className="w-full h-12 text-base font-bold bg-green-700 hover:bg-green-800 text-white rounded-lg shadow-sm transition-colors"
                  >
                    {submitting ? (
                      <span className="flex items-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span>Opening terminal...</span>
                      </span>
                    ) : (
                      <span>Continue</span>
                    )}
                  </Button>
                </form>
              </CardContent>
            </Card>
          )}
        </section>

        {/* 4. Three Simple Benefit Points */}
        <section className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4 border-t border-stone-200">
          <div className="p-4 rounded-xl bg-white border border-stone-200 shadow-sm">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-green-50 border border-green-200 text-green-700 mb-3">
              <Banknote className="h-5 w-5" />
            </div>
            <div className="font-bold text-sm text-stone-900">
              Get paid the moment you weigh it in
            </div>
            <div className="text-xs text-stone-500 mt-1">
              Immediate calculation and verified scale slips on spot.
            </div>
          </div>

          <div className="p-4 rounded-xl bg-white border border-stone-200 shadow-sm">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-50 border border-amber-200 text-amber-700 mb-3">
              <FileCheck className="h-5 w-5" />
            </div>
            <div className="font-bold text-sm text-stone-900">
              Build a record that can help you get a loan later
            </div>
            <div className="text-xs text-stone-500 mt-1">
              Formal transactions create verifiable proof of income.
            </div>
          </div>

          <div className="p-4 rounded-xl bg-white border border-stone-200 shadow-sm">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100 border border-slate-200 text-slate-700 mb-3">
              <Globe className="h-5 w-5" />
            </div>
            <div className="font-bold text-sm text-stone-900">
              No app to download — works right in the browser
            </div>
            <div className="text-xs text-stone-500 mt-1">
              Ready instantly on any mobile phone, tablet, or PC.
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-stone-200 bg-white px-4 py-3 text-center text-xs text-stone-500 mt-auto">
        Dhatu Setu • Government of India, Ministry of Mines
      </footer>
    </div>
  )
}
