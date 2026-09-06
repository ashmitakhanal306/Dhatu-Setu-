"use client"

import * as React from "react"
import { useState, useEffect, useCallback, useMemo } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { supabase, type MaterialCode, type Dispatch, type Facility } from "@/lib/supabase"
import { getSession, clearSession, type UserSession } from "@/lib/session"
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
  Building2,
  ShieldCheck,
  Scale,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  AlertCircle,
  RefreshCw,
  ArrowLeft,
  Loader2,
  LogOut,
  Clock,
  Inbox,
  History,
  TrendingDown,
  TrendingUp,
} from "lucide-react"

// Built-in fallback aggregators for display lookup if DB query fails
const DEMO_AGGREGATORS: Record<string, { name: string; location: string }> = {
  "agg-001": { name: "Delhi Central Godown", location: "Karol Bagh, New Delhi" },
  "agg-002": { name: "Mumbai West Scrap Yard", location: "Dharavi, Mumbai" },
}

const MATERIAL_META: Record<
  MaterialCode,
  { name: string; color: string; border: string; badge: string }
> = {
  COPPER: {
    name: "Copper",
    color: "from-amber-600 to-orange-500",
    border: "border-amber-300",
    badge: "border-amber-300 bg-amber-50 text-amber-900",
  },
  ALUMINUM: {
    name: "Aluminum",
    color: "from-slate-500 to-slate-400",
    border: "border-slate-300",
    badge: "border-slate-300 bg-slate-100 text-slate-800",
  },
  EWASTE: {
    name: "E-Waste",
    color: "from-green-600 to-emerald-600",
    border: "border-green-300",
    badge: "border-green-300 bg-green-50 text-green-900",
  },
}

export default function RecyclerPortalPage() {
  const router = useRouter()
  const [session, setSessionState] = useState<UserSession | null>(null)
  const [isAuthChecking, setIsAuthChecking] = useState<boolean>(true)

  const [dispatches, setDispatches] = useState<Dispatch[]>([])
  const [facilitiesMap, setFacilitiesMap] = useState<Record<string, { name: string; location: string }>>(
    DEMO_AGGREGATORS
  )
  const [loading, setLoading] = useState<boolean>(true)
  const [actionInProgressId, setActionInProgressId] = useState<string | null>(null)
  const [lastSync, setLastSync] = useState<string>("")

  // Form input state per card: dispatchId -> receivedWeight
  const [receivedWeights, setReceivedWeights] = useState<Record<string, string>>({})
  // Form input state per card: dispatchId -> rejectionReason
  const [rejectionReasons, setRejectionReasons] = useState<Record<string, string>>({})

  // 1. Auth Guard: Recycler role required
  useEffect(() => {
    const s = getSession()
    if (!s || s.role !== "Recycler") {
      router.replace("/")
    } else {
      setSessionState(s)
      setIsAuthChecking(false)
    }
  }, [router])

  // 2. Fetch facilities map for aggregator display lookup
  useEffect(() => {
    async function loadFacilities() {
      try {
        const { data, error } = await supabase.from("facilities").select("id, name, location")
        if (!error && data) {
          const map: Record<string, { name: string; location: string }> = { ...DEMO_AGGREGATORS }
          data.forEach((f) => {
            map[f.id] = { name: f.name, location: f.location }
          })
          setFacilitiesMap(map)
        }
      } catch {
        // preserve fallback
      }
    }
    loadFacilities()
  }, [])

  // 3. Fetch dispatches for this logged-in recycler
  const fetchDispatches = useCallback(async () => {
    const s = getSession()
    if (!s || !s.facilityId) return

    setLoading(true)
    try {
      const { data, error } = await supabase
        .from("dispatches")
        .select("*")
        .eq("recycler_id", s.facilityId)
        .order("timestamp", { ascending: false })

      if (error) throw error

      const rows = (data as Dispatch[]) || []
      setDispatches(rows)

      // Initialize received weights map for pending rows
      setReceivedWeights((prev) => {
        const updated = { ...prev }
        rows.forEach((d) => {
          if ((!d.status || d.status === "PENDING") && updated[d.id] === undefined) {
            updated[d.id] = d.weight_kg.toString()
          }
        })
        return updated
      })

      setLastSync(
        new Date().toLocaleTimeString("en-IN", {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        })
      )
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to load consignments"
      toast({
        title: "Sync Error",
        description: msg,
        type: "error",
      })
    } finally {
      setLoading(false)
    }
  }, [])

  // Initial fetch and Realtime subscription
  useEffect(() => {
    if (!isAuthChecking) {
      fetchDispatches()

      // Realtime subscription for incoming dispatches
      const channel = supabase
        .channel("recycler-dispatches-channel")
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "dispatches",
          },
          () => {
            fetchDispatches()
          }
        )
        .subscribe()

      return () => {
        supabase.removeChannel(channel)
      }
    }
  }, [isAuthChecking, fetchDispatches])

  // Partition into Pending and Recent Decisions
  const pendingDispatches = useMemo(() => {
    return dispatches.filter((d) => !d.status || d.status === "PENDING")
  }, [dispatches])

  const recentDecisions = useMemo(() => {
    return dispatches
      .filter((d) => d.status === "ACCEPTED" || d.status === "REJECTED")
      .slice(0, 10)
  }, [dispatches])

  // Handle Accept
  const handleAccept = async (dispatchItem: Dispatch) => {
    const enteredWeightStr = receivedWeights[dispatchItem.id] ?? dispatchItem.weight_kg.toString()
    const enteredWeightNum = parseFloat(enteredWeightStr)

    if (isNaN(enteredWeightNum) || enteredWeightNum <= 0) {
      toast({
        title: "Invalid Scale Weight",
        description: "Please enter a valid weight in kg before accepting custody.",
        type: "error",
      })
      return
    }

    setActionInProgressId(dispatchItem.id)

    try {
      const { error } = await supabase
        .from("dispatches")
        .update({
          status: "ACCEPTED",
          received_weight_kg: enteredWeightNum,
        })
        .eq("id", dispatchItem.id)

      if (error) throw error

      const claimed = Number(dispatchItem.weight_kg)
      const diff = enteredWeightNum - claimed
      const diffText =
        Math.abs(diff) > 0.01
          ? ` (Variance: ${diff > 0 ? "+" : ""}${diff.toFixed(2)} kg)`
          : " (Exact match)"

      toast({
        title: "✅ Consignment Accepted",
        description: `Verified ${enteredWeightNum.toFixed(2)} kg of ${
          dispatchItem.material_code
        }${diffText}. Ownership transferred to recycler.`,
        type: "success",
      })

      await fetchDispatches()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to accept consignment"
      toast({
        title: "Action Error",
        description: msg,
        type: "error",
      })
    } finally {
      setActionInProgressId(null)
    }
  }

  // Handle Reject
  const handleReject = async (dispatchItem: Dispatch) => {
    const reason = (rejectionReasons[dispatchItem.id] || "").trim()

    if (!reason || reason.length < 3) {
      toast({
        title: "Rejection Reason Required",
        description: "Please specify a reason for rejecting this consignment before submitting.",
        type: "error",
      })
      return
    }

    setActionInProgressId(dispatchItem.id)

    try {
      const { error } = await supabase
        .from("dispatches")
        .update({
          status: "REJECTED",
          rejection_reason: reason,
        })
        .eq("id", dispatchItem.id)

      if (error) throw error

      toast({
        title: "🚫 Consignment Rejected",
        description: `Consignment rejected. Reason logged: "${reason}". Material remains in aggregator godown inventory.`,
        type: "error",
      })

      await fetchDispatches()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to reject consignment"
      toast({
        title: "Action Error",
        description: msg,
        type: "error",
      })
    } finally {
      setActionInProgressId(null)
    }
  }

  // Loading Screen for auth
  if (isAuthChecking) {
    return (
      <div className="min-h-screen bg-stone-50 flex flex-col items-center justify-center text-stone-500 gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
        <p className="text-xs uppercase tracking-widest font-mono text-stone-500">
          Verifying Formal Recycler Authorization...
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
              className="inline-flex items-center gap-1.5 text-xs text-stone-500 hover:text-stone-800 transition-colors p-1.5 rounded-md hover:bg-stone-100"
            >
              <ArrowLeft className="h-4 w-4" />
              <span>Hub</span>
            </Link>
            <div className="h-4 w-px bg-stone-300" />
            <div className="flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50 border border-blue-200 text-blue-700">
                <Building2 className="h-5 w-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono font-bold tracking-widest text-blue-700 uppercase">
                    FORMAL RECYCLER TERMINAL
                  </span>
                  <span className="text-stone-300">•</span>
                  <span className="text-xs text-stone-700 font-medium">
                    {session?.facilityName || "Recycler Plant"}
                  </span>
                  <span className="text-xs text-stone-500 font-mono hidden sm:inline">
                    ({session?.facilityId})
                  </span>
                </div>
                <h1 className="text-base sm:text-lg font-bold tracking-tight text-stone-900 leading-tight">
                  Inbound Consignment Handshake &amp; Verification
                </h1>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-end">
            <div className="flex items-center gap-2 text-xs font-mono text-stone-600 bg-stone-100 px-3 py-1.5 rounded-lg border border-stone-200">
              <span className="h-2 w-2 rounded-full bg-green-600 animate-pulse" />
              <span>LIVE FEED</span>
              {lastSync && <span className="text-stone-500 hidden sm:inline">({lastSync})</span>}
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={fetchDispatches}
              disabled={loading}
              className="border-stone-300 bg-white hover:bg-stone-100 text-stone-700 text-xs font-semibold gap-1.5 h-8"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
              <span>Refresh</span>
            </Button>

            <Link href="/dashboard">
              <Button
                size="sm"
                variant="outline"
                className="border-blue-300 bg-blue-50 hover:bg-blue-100 text-blue-800 text-xs font-bold gap-1.5 h-8 shadow-sm"
              >
                <ShieldCheck className="h-3.5 w-3.5 text-blue-700" />
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
        {/* Section 1: Pending Inbound Consignments */}
        <section className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
            <div>
              <h2 className="text-sm sm:text-base font-bold tracking-wider text-stone-800 uppercase flex items-center gap-2">
                <Inbox className="h-5 w-5 text-amber-600" />
                <span>Pending Consignment Handshakes</span>
                <span className="bg-amber-100 text-amber-900 border border-amber-300 text-xs font-mono font-bold px-2 py-0.5 rounded-full">
                  {pendingDispatches.length} Awaiting Verification
                </span>
              </h2>
              <p className="text-xs text-stone-500 mt-1">
                Aggregators have dispatched these critical mineral shipments to your facility. Inspect weight on scale and confirm or reject custody.
              </p>
            </div>
          </div>

          {pendingDispatches.length === 0 ? (
            <Card className="border-stone-200 bg-white p-8 text-center shadow-sm">
              <div className="flex flex-col items-center justify-center max-w-md mx-auto space-y-3">
                <div className="h-12 w-12 rounded-full bg-stone-100 flex items-center justify-center text-stone-500">
                  <CheckCircle2 className="h-6 w-6 text-green-700" />
                </div>
                <h3 className="text-base font-bold text-stone-900">No Pending Consignments</h3>
                <p className="text-xs text-stone-500 leading-relaxed">
                  All inbound dispatches have been reviewed and verified. Any new batch authorized from an aggregator godown will appear here instantly via live stream.
                </p>
              </div>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {pendingDispatches.map((item) => {
                const aggregator = facilitiesMap[item.aggregator_id] || {
                  name: `Aggregator Godown (${item.aggregator_id})`,
                  location: "Registered Godown",
                }
                const formattedDate = new Date(item.timestamp).toLocaleString("en-IN", {
                  day: "2-digit",
                  month: "short",
                  hour: "2-digit",
                  minute: "2-digit",
                })

                const claimedWeight = Number(item.weight_kg)
                const currentEnteredWeight = receivedWeights[item.id] ?? claimedWeight.toString()
                const parsedEntered = parseFloat(currentEnteredWeight) || 0
                const diff = parsedEntered - claimedWeight
                const diffPct = claimedWeight > 0 ? Math.abs(diff) / claimedWeight : 0
                const isDiscrepant = diffPct > 0.02
                const currentReason = rejectionReasons[item.id] || ""
                const isActionBusy = actionInProgressId === item.id

                return (
                  <Card
                    key={item.id}
                    className="border-stone-200 bg-white shadow-sm overflow-hidden flex flex-col justify-between"
                  >
                    <CardHeader className="border-b border-stone-100 bg-white pb-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <Badge
                              variant="outline"
                              className={`font-mono text-xs ${
                                MATERIAL_META[item.material_code]?.badge || "border-stone-200"
                              }`}
                            >
                              {MATERIAL_META[item.material_code]?.name || item.material_code}
                            </Badge>
                            <span className="text-[11px] font-mono text-stone-400">
                              ID: {item.id.slice(0, 8)}...
                            </span>
                          </div>
                          <CardTitle className="text-base font-bold text-stone-900">
                            {aggregator.name}
                          </CardTitle>
                          <CardDescription className="text-xs text-stone-500 flex items-center gap-1">
                            <span>Origin: {aggregator.location}</span>
                          </CardDescription>
                        </div>

                        <div className="text-right">
                          <span className="text-[11px] font-mono text-stone-400 block">
                            {formattedDate}
                          </span>
                          <span className="text-xs text-amber-800 font-semibold flex items-center justify-end gap-1 mt-1">
                            <Clock className="h-3 w-3 animate-pulse" />
                            Pending Receipt
                          </span>
                        </div>
                      </div>
                    </CardHeader>

                    <CardContent className="p-5 space-y-4 flex-1 flex flex-col justify-between">
                      {/* Weight Comparison & Input */}
                      <div className="space-y-3">
                        <div className="grid grid-cols-2 gap-3 p-3 rounded-lg bg-stone-50 border border-stone-200">
                          <div>
                            <span className="text-[11px] font-mono font-semibold uppercase text-stone-500 block">
                              Claimed Weight (Godown)
                            </span>
                            <span className="text-xl font-black font-mono text-stone-900">
                              {claimedWeight.toFixed(2)}{" "}
                              <span className="text-xs font-normal text-stone-500">kg</span>
                            </span>
                          </div>

                          <div>
                            <span className="text-[11px] font-semibold uppercase text-stone-700 block">
                              Weight you actually received (kg)
                            </span>
                            <div className="flex items-center gap-1.5 mt-0.5">
                              <Input
                                type="number"
                                step="0.01"
                                min="0.01"
                                value={currentEnteredWeight}
                                onChange={(e) =>
                                  setReceivedWeights((prev) => ({
                                    ...prev,
                                    [item.id]: e.target.value,
                                  }))
                                }
                                disabled={isActionBusy}
                                className="h-9 font-mono font-bold text-base bg-white border-stone-300 text-stone-900 focus-visible:ring-green-600"
                              />
                              <span className="text-xs font-mono font-bold text-stone-500">kg</span>
                            </div>
                          </div>
                        </div>

                        {/* Weight Mismatch Indicator */}
                        {diff !== 0 && !isNaN(diff) && (
                          <div
                            className={`p-2 rounded-md text-xs flex items-center justify-between font-mono ${
                              isDiscrepant
                                ? "bg-amber-50 border border-amber-300 text-amber-900"
                                : "bg-stone-100 border border-stone-200 text-stone-700"
                            }`}
                          >
                            <span className="flex items-center gap-1">
                              {isDiscrepant ? (
                                <AlertTriangle className="h-3.5 w-3.5 text-amber-600 shrink-0" />
                              ) : (
                                <Scale className="h-3.5 w-3.5 text-stone-500 shrink-0" />
                              )}
                              <span>
                                Net Diff: {diff > 0 ? `+${diff.toFixed(2)}` : diff.toFixed(2)} kg (
                                {(diffPct * 100).toFixed(1)}%)
                              </span>
                            </span>
                            {isDiscrepant && (
                              <Badge className="bg-amber-100 text-amber-900 border-amber-300 text-[10px] font-medium">
                                Flagged — weight mismatch
                              </Badge>
                            )}
                          </div>
                        )}

                        {/* Rejection Reason Field */}
                        <div className="space-y-1.5 pt-1">
                          <label className="text-[11px] font-semibold text-stone-600 uppercase tracking-wider flex items-center justify-between">
                            <span>Reason for rejection (required to reject)</span>
                          </label>
                          <Input
                            type="text"
                            placeholder="e.g. Moisture contamination, uncertified scrap grading, bad tare weight"
                            value={currentReason}
                            onChange={(e) =>
                              setRejectionReasons((prev) => ({
                                ...prev,
                                [item.id]: e.target.value,
                              }))
                            }
                            disabled={isActionBusy}
                            className="h-9 text-xs bg-white border-stone-300 text-stone-900 placeholder:text-stone-400 focus-visible:ring-red-500"
                          />
                        </div>
                      </div>

                      {/* Action Buttons */}
                      <div className="grid grid-cols-2 gap-3 pt-2">
                        <Button
                          type="button"
                          onClick={() => handleAccept(item)}
                          disabled={isActionBusy || parsedEntered <= 0}
                          className="h-11 bg-green-700 hover:bg-green-800 text-white font-bold text-xs gap-1.5 shadow-sm"
                        >
                          {isActionBusy ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <>
                              <CheckCircle2 className="h-4 w-4" />
                              <span>Confirm Received</span>
                            </>
                          )}
                        </Button>

                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => handleReject(item)}
                          disabled={isActionBusy || currentReason.trim().length < 3}
                          className="h-11 border-red-300 bg-white hover:bg-red-50 text-red-700 font-bold text-xs gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                        >
                          {isActionBusy ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <>
                              <XCircle className="h-4 w-4" />
                              <span>Reject</span>
                            </>
                          )}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          )}
        </section>

        {/* Section 2: Recent Decisions Audit Log */}
        <section className="space-y-3 pt-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm sm:text-base font-bold tracking-wider text-stone-800 uppercase flex items-center gap-2">
              <History className="h-5 w-5 text-blue-700" />
              <span>Recent Recycler Handshake Decisions (Audit Log)</span>
            </h2>
            <span className="text-xs font-mono text-stone-500">
              Showing last {recentDecisions.length} decisions
            </span>
          </div>

          <Card className="border-stone-200 bg-white shadow-sm overflow-hidden">
            <Table>
              <TableHeader className="bg-stone-50 border-b border-stone-200">
                <TableRow className="border-stone-200 hover:bg-transparent">
                  <TableHead className="font-bold text-stone-700">Timestamp</TableHead>
                  <TableHead className="font-bold text-stone-700">Material</TableHead>
                  <TableHead className="font-bold text-stone-700">Source Aggregator</TableHead>
                  <TableHead className="font-bold text-stone-700 text-right">Claimed Weight</TableHead>
                  <TableHead className="font-bold text-stone-700 text-right">Received Weight</TableHead>
                  <TableHead className="font-bold text-stone-700 text-center">Decision Status</TableHead>
                  <TableHead className="font-bold text-stone-700">MoM Audit Note</TableHead>
                </TableRow>
              </TableHeader>

              <TableBody>
                {recentDecisions.length === 0 ? (
                  <TableRow className="border-stone-200 hover:bg-transparent">
                    <TableCell colSpan={7} className="text-center py-8 text-stone-400 text-xs">
                      No decisions recorded yet. Once you accept or reject pending consignments above, they will appear in this verified ledger.
                    </TableCell>
                  </TableRow>
                ) : (
                  recentDecisions.map((d) => {
                    const aggregator = facilitiesMap[d.aggregator_id] || {
                      name: d.aggregator_id,
                      location: "",
                    }
                    const formattedDate = new Date(d.timestamp).toLocaleString("en-IN", {
                      day: "2-digit",
                      month: "short",
                      hour: "2-digit",
                      minute: "2-digit",
                    })

                    const claimed = Number(d.weight_kg)
                    const received = d.received_weight_kg != null ? Number(d.received_weight_kg) : claimed
                    const diffPct = claimed > 0 ? Math.abs(received - claimed) / claimed : 0
                    const isDiscrepant = d.status === "ACCEPTED" && diffPct > 0.02

                    return (
                      <TableRow key={d.id} className="border-stone-100 hover:bg-stone-50/80">
                        <TableCell className="font-mono text-xs text-stone-500">
                          {formattedDate}
                        </TableCell>

                        <TableCell>
                          <Badge
                            variant="outline"
                            className={`font-mono text-xs ${
                              MATERIAL_META[d.material_code]?.badge || "border-stone-200"
                            }`}
                          >
                            {d.material_code}
                          </Badge>
                        </TableCell>

                        <TableCell className="text-sm font-medium text-stone-900">
                          {aggregator.name}
                        </TableCell>

                        <TableCell className="text-right font-mono font-medium text-stone-700 text-sm">
                          {claimed.toFixed(2)}{" "}
                          <span className="text-xs text-stone-400">kg</span>
                        </TableCell>

                        <TableCell className="text-right font-mono font-bold text-stone-900 text-sm">
                          {d.status === "ACCEPTED" ? (
                            <>
                              {received.toFixed(2)}{" "}
                              <span className="text-xs text-stone-500">kg</span>
                            </>
                          ) : (
                            <span className="text-xs text-stone-400 font-mono">—</span>
                          )}
                        </TableCell>

                        <TableCell className="text-center">
                          {d.status === "ACCEPTED" && (
                            <Badge className="bg-green-50 text-green-900 border border-green-300 text-xs gap-1.5 font-medium">
                              <CheckCircle2 className="h-3 w-3 text-green-700" />
                              Confirmed received
                            </Badge>
                          )}
                          {d.status === "REJECTED" && (
                            <Badge className="bg-red-50 text-red-900 border border-red-300 text-xs gap-1.5 font-medium">
                              <XCircle className="h-3 w-3 text-red-700" />
                              Rejected
                            </Badge>
                          )}
                        </TableCell>

                        <TableCell className="text-xs">
                          {isDiscrepant && (
                            <Badge className="bg-amber-50 text-amber-900 border border-amber-300 text-[11px] font-medium gap-1">
                              <AlertTriangle className="h-3 w-3 text-amber-600" />
                              Flagged — weight mismatch
                            </Badge>
                          )}
                          {d.status === "REJECTED" && d.rejection_reason && (
                            <span className="text-red-700 font-medium italic">
                              &quot;{d.rejection_reason}&quot;
                            </span>
                          )}
                          {!isDiscrepant && d.status === "ACCEPTED" && (
                            <span className="text-stone-500 font-mono text-[11px]">
                              Verified Chain Match
                            </span>
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
        Formal Recycling Plant Terminal • Ministry of Mines (MoM) Critical Mineral Handshake Verification
      </footer>
    </div>
  )
}
