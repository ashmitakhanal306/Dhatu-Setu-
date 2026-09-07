"use client"

import * as React from "react"
import { useState, useEffect, useRef } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  Recycle,
  ArrowRight,
  Warehouse,
  Factory,
  ShieldCheck,
  Banknote,
  FileCheck,
  Globe,
  CheckCircle2,
  TrendingUp,
  Leaf,
  ChevronRight,
  Menu,
  X,
  Sparkles,
  Scale,
  Building2,
  BarChart3,
  Zap,
  Star,
  Award,
} from "lucide-react"

// ── Animated Counter ─────────────────────────────────────────────────
function AnimatedCounter({ target, suffix = "", prefix = "" }: { target: number; suffix?: string; prefix?: string }) {
  const [count, setCount] = useState(0)
  const ref = useRef<HTMLSpanElement>(null)
  const started = useRef(false)

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !started.current) {
          started.current = true
          const duration = 1800
          const start = Date.now()
          const tick = () => {
            const elapsed = Date.now() - start
            const progress = Math.min(elapsed / duration, 1)
            const ease = 1 - Math.pow(1 - progress, 3)
            setCount(Math.round(ease * target))
            if (progress < 1) requestAnimationFrame(tick)
          }
          requestAnimationFrame(tick)
        }
      },
      { threshold: 0.5 }
    )
    if (ref.current) observer.observe(ref.current)
    return () => observer.disconnect()
  }, [target])

  return (
    <span ref={ref}>
      {prefix}{count.toLocaleString("en-IN")}{suffix}
    </span>
  )
}

export default function HomePage() {
  const router = useRouter()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20)
    window.addEventListener("scroll", onScroll)
    return () => window.removeEventListener("scroll", onScroll)
  }, [])

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans overflow-x-hidden">

      {/* ── Sticky Navbar ──────────────────────────────────────────────── */}
      <header
        className={`sticky top-0 z-50 w-full transition-all duration-300 ${
          scrolled
            ? "bg-white/95 backdrop-blur-md shadow-sm border-b border-slate-200/80"
            : "bg-transparent"
        }`}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-600 to-teal-700 shadow-md">
                <Recycle className="h-5 w-5 text-white" />
              </div>
              <div className="flex flex-col leading-tight">
                <span className="text-lg font-black tracking-tight text-slate-900">
                  Dhatu<span className="text-emerald-600">Setu</span>
                </span>
                <span className="text-[10px] text-slate-500 font-medium -mt-0.5 tracking-wider uppercase">
                  Ministry of Mines
                </span>
              </div>
            </div>

            {/* Desktop Nav */}
            <nav className="hidden md:flex items-center gap-7">
              <a href="#features" className="text-sm font-medium text-slate-600 hover:text-emerald-700 transition-colors">
                Features
              </a>
              <a href="#how-it-works" className="text-sm font-medium text-slate-600 hover:text-emerald-700 transition-colors">
                How It Works
              </a>
              <a href="#impact" className="text-sm font-medium text-slate-600 hover:text-emerald-700 transition-colors">
                Impact
              </a>
              <Link href="/dashboard" className="text-sm font-medium text-slate-600 hover:text-emerald-700 transition-colors">
                MoM Dashboard
              </Link>
            </nav>

            {/* CTA */}
            <div className="hidden md:flex items-center gap-3">
              <Link
                href="/login"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 text-white text-sm font-bold shadow-md shadow-emerald-500/25 hover:shadow-lg hover:shadow-emerald-500/35 hover:from-emerald-500 hover:to-teal-500 transition-all duration-200 active:scale-95"
              >
                <span>Sign In</span>
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>

            {/* Mobile Menu Button */}
            <button
              className="md:hidden p-2 rounded-lg text-slate-600 hover:bg-slate-100 transition-colors"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-label="Toggle menu"
            >
              {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <div className="md:hidden bg-white border-t border-slate-200 px-4 py-4 space-y-3 animate-slide-down">
            <a href="#features" className="block text-sm font-medium text-slate-700 py-2">Features</a>
            <a href="#how-it-works" className="block text-sm font-medium text-slate-700 py-2">How It Works</a>
            <a href="#impact" className="block text-sm font-medium text-slate-700 py-2">Impact</a>
            <Link href="/dashboard" className="block text-sm font-medium text-slate-700 py-2">MoM Dashboard</Link>
            <Link
              href="/login"
              className="flex items-center justify-center gap-2 w-full px-4 py-3 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 text-white text-sm font-bold"
            >
              Sign In <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        )}
      </header>

      {/* ── Hero Section ───────────────────────────────────────────────── */}
      <section className="relative hero-gradient overflow-hidden">
        {/* Background Orbs */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-1/4 -left-24 w-96 h-96 rounded-full bg-emerald-500/10 blur-3xl" />
          <div className="absolute bottom-1/4 -right-24 w-96 h-96 rounded-full bg-teal-500/10 blur-3xl" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] rounded-full bg-emerald-900/20 blur-3xl" />
        </div>

        {/* Grid Pattern */}
        <div
          className="absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage: "linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)",
            backgroundSize: "48px 48px",
          }}
        />

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24 sm:py-32 lg:py-40">
          <div className="text-center space-y-8">
            {/* Badge */}
            <div className="animate-fade-up inline-flex items-center gap-2 rounded-full bg-emerald-500/15 border border-emerald-500/30 px-4 py-1.5 text-xs font-semibold text-emerald-300 tracking-wider uppercase">
              <Sparkles className="h-3.5 w-3.5" />
              <span>Critical Mineral Traceability Network</span>
            </div>

            {/* Headline */}
            <h1 className="animate-fade-up-delay-1 text-4xl sm:text-5xl lg:text-7xl font-black tracking-tight text-white leading-[1.08]">
              Turning Scrap into{" "}
              <span className="shimmer-text">Certified Value</span>
            </h1>

            {/* Subtext */}
            <p className="animate-fade-up-delay-2 text-lg sm:text-xl text-slate-300 max-w-2xl mx-auto leading-relaxed">
              India&apos;s first end-to-end platform connecting informal Kabadiwala collectors, Aggregator godowns,
              and formal Recycling plants — verified by the Ministry of Mines.
            </p>

            {/* CTA Buttons */}
            <div className="animate-fade-up-delay-3 flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link
                href="/login"
                className="group inline-flex items-center gap-2.5 px-8 py-4 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-bold text-base shadow-xl shadow-emerald-500/30 hover:shadow-2xl hover:shadow-emerald-500/40 hover:from-emerald-400 hover:to-teal-400 transition-all duration-200 active:scale-95 animate-pulse-glow"
              >
                <span>Access Your Terminal</span>
                <ArrowRight className="h-5 w-5 group-hover:translate-x-1 transition-transform" />
              </Link>
              <Link
                href="/dashboard"
                className="inline-flex items-center gap-2 px-8 py-4 rounded-2xl glass text-white font-semibold text-base hover:bg-white/15 transition-all duration-200"
              >
                <BarChart3 className="h-5 w-5 text-emerald-400" />
                <span>View Live Dashboard</span>
              </Link>
            </div>

            {/* Trust badges */}
            <div className="animate-fade-up-delay-4 flex flex-wrap items-center justify-center gap-6 pt-4">
              {[
                { icon: ShieldCheck, text: "Ministry of Mines Verified" },
                { icon: Award, text: "SIH 2024 Project" },
                { icon: Leaf, text: "Sustainable Supply Chain" },
              ].map(({ icon: Icon, text }) => (
                <div key={text} className="flex items-center gap-2 text-slate-400 text-xs font-medium">
                  <Icon className="h-4 w-4 text-emerald-400" />
                  <span>{text}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Wave divider */}
        <div className="absolute bottom-0 left-0 right-0">
          <svg viewBox="0 0 1440 80" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-12 sm:h-20">
            <path d="M0 80H1440V40C1200 80 960 0 720 0C480 0 240 80 0 40V80Z" fill="#f8fafc"/>
          </svg>
        </div>
      </section>

      {/* ── Stats Bar ──────────────────────────────────────────────────── */}
      <section id="impact" className="bg-slate-50 py-12 sm:py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 sm:gap-8">
            {[
              { label: "Tonnes Tracked", value: 12400, suffix: "+", color: "text-emerald-600", icon: Scale },
              { label: "Registered Facilities", value: 340, suffix: "+", color: "text-teal-600", icon: Warehouse },
              { label: "Collectors Paid (DBT)", value: 8200, suffix: "+", color: "text-blue-600", icon: Banknote },
              { label: "Verified Dispatches", value: 51000, suffix: "+", color: "text-purple-600", icon: FileCheck },
            ].map(({ label, value, suffix, color, icon: Icon }) => (
              <div
                key={label}
                className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200/80 text-center hover:shadow-md transition-shadow"
              >
                <div className={`flex items-center justify-center h-10 w-10 rounded-xl bg-slate-100 mx-auto mb-3`}>
                  <Icon className={`h-5 w-5 ${color}`} />
                </div>
                <div className={`text-3xl sm:text-4xl font-black ${color}`}>
                  <AnimatedCounter target={value} suffix={suffix} />
                </div>
                <div className="text-sm text-slate-500 font-medium mt-1">{label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Features / Roles Section ───────────────────────────────────── */}
      <section id="features" className="py-20 sm:py-28 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-14">
            <div className="inline-flex items-center gap-2 rounded-full bg-emerald-50 border border-emerald-200 px-4 py-1.5 text-xs font-semibold text-emerald-700 mb-4">
              <Zap className="h-3.5 w-3.5" /> Three Roles, One Platform
            </div>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight text-slate-900">
              Built for every stakeholder
            </h2>
            <p className="mt-4 text-lg text-slate-500 max-w-2xl mx-auto">
              From the Kabadiwala on the street to the Ministry office — everyone has a role in the chain.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8">
            {/* Aggregator */}
            <div className="group relative bg-gradient-to-br from-emerald-50 to-teal-50 rounded-3xl p-7 border border-emerald-200/60 hover:border-emerald-300 hover:shadow-xl hover:shadow-emerald-500/10 transition-all duration-300">
              <div className="absolute top-5 right-5 opacity-0 group-hover:opacity-100 transition-opacity">
                <ChevronRight className="h-5 w-5 text-emerald-600" />
              </div>
              <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg shadow-emerald-500/30 mb-5">
                <Warehouse className="h-7 w-7 text-white" />
              </div>
              <div className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-800 mb-3">
                Aggregator
              </div>
              <h3 className="text-xl font-black text-slate-900 mb-3">Collection Center</h3>
              <p className="text-slate-600 text-sm leading-relaxed mb-5">
                Weigh incoming scrap on a certified scale, register Kabadiwala collectors for DBT payments, log metal categories, and dispatch verified batches to formal recyclers.
              </p>
              <ul className="space-y-2">
                {["Scale POS Terminal", "Kabadiwala DBT Registration", "Dispatch Batching", "Inventory Ledger"].map((f) => (
                  <li key={f} className="flex items-center gap-2 text-sm text-slate-700">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                    {f}
                  </li>
                ))}
              </ul>
              <Link href="/login" className="mt-6 inline-flex items-center gap-2 text-sm font-bold text-emerald-700 hover:text-emerald-800 transition-colors">
                Access Terminal <ArrowRight className="h-4 w-4" />
              </Link>
            </div>

            {/* Recycler */}
            <div className="group relative bg-gradient-to-br from-blue-50 to-indigo-50 rounded-3xl p-7 border border-blue-200/60 hover:border-blue-300 hover:shadow-xl hover:shadow-blue-500/10 transition-all duration-300">
              <div className="absolute top-5 right-5 opacity-0 group-hover:opacity-100 transition-opacity">
                <ChevronRight className="h-5 w-5 text-blue-600" />
              </div>
              <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/30 mb-5">
                <Factory className="h-7 w-7 text-white" />
              </div>
              <div className="inline-flex items-center gap-1.5 rounded-full bg-blue-100 px-3 py-1 text-xs font-bold text-blue-800 mb-3">
                Formal Recycler
              </div>
              <h3 className="text-xl font-black text-slate-900 mb-3">Recycling Plant</h3>
              <p className="text-slate-600 text-sm leading-relaxed mb-5">
                Receive inbound consignments from Aggregator godowns, verify weight on your certified plant scale, confirm or reject custody, and maintain an immutable audit log.
              </p>
              <ul className="space-y-2">
                {["Inbound Verification", "Weight Discrepancy Flags", "Custody Handshake", "Audit Decision Log"].map((f) => (
                  <li key={f} className="flex items-center gap-2 text-sm text-slate-700">
                    <CheckCircle2 className="h-4 w-4 text-blue-600 shrink-0" />
                    {f}
                  </li>
                ))}
              </ul>
              <Link href="/login" className="mt-6 inline-flex items-center gap-2 text-sm font-bold text-blue-700 hover:text-blue-800 transition-colors">
                Access Terminal <ArrowRight className="h-4 w-4" />
              </Link>
            </div>

            {/* MoM */}
            <div className="group relative bg-gradient-to-br from-amber-50 to-orange-50 rounded-3xl p-7 border border-amber-200/60 hover:border-amber-300 hover:shadow-xl hover:shadow-amber-500/10 transition-all duration-300">
              <div className="absolute top-5 right-5 opacity-0 group-hover:opacity-100 transition-opacity">
                <ChevronRight className="h-5 w-5 text-amber-600" />
              </div>
              <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center shadow-lg shadow-amber-500/30 mb-5">
                <Building2 className="h-7 w-7 text-white" />
              </div>
              <div className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-800 mb-3">
                Ministry of Mines
              </div>
              <h3 className="text-xl font-black text-slate-900 mb-3">Government Dashboard</h3>
              <p className="text-slate-600 text-sm leading-relaxed mb-5">
                Monitor the entire critical mineral supply chain in real-time. View analytics, compliance metrics, Kabadiwala income statistics, and flag anomalies across all facilities.
              </p>
              <ul className="space-y-2">
                {["Real-time Analytics", "Compliance Monitoring", "Income Statistics", "Supply Chain Visibility"].map((f) => (
                  <li key={f} className="flex items-center gap-2 text-sm text-slate-700">
                    <CheckCircle2 className="h-4 w-4 text-amber-600 shrink-0" />
                    {f}
                  </li>
                ))}
              </ul>
              <Link href="/login" className="mt-6 inline-flex items-center gap-2 text-sm font-bold text-amber-700 hover:text-amber-800 transition-colors">
                Access Dashboard <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ── How It Works ───────────────────────────────────────────────── */}
      <section id="how-it-works" className="py-20 sm:py-28 bg-slate-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-14">
            <div className="inline-flex items-center gap-2 rounded-full bg-slate-200 px-4 py-1.5 text-xs font-semibold text-slate-700 mb-4">
              Simple. Fast. Verified.
            </div>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight text-slate-900">
              How DhatuSetu works
            </h2>
            <p className="mt-4 text-lg text-slate-500 max-w-xl mx-auto">
              Four simple steps from street-level scrap to formal recycling.
            </p>
          </div>

          <div className="relative">
            {/* Connector line (desktop) */}
            <div className="hidden lg:block absolute top-16 left-[12.5%] right-[12.5%] h-0.5 bg-gradient-to-r from-emerald-300 via-teal-300 to-blue-300" />

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
              {[
                {
                  step: "01",
                  title: "Kabadiwala Drops Off",
                  desc: "Informal collector brings scrap to the registered Aggregator godown.",
                  icon: Recycle,
                  color: "from-emerald-500 to-teal-500",
                  bg: "bg-emerald-50",
                  border: "border-emerald-200",
                },
                {
                  step: "02",
                  title: "Weigh & Log",
                  desc: "Aggregator weighs on a certified scale. Material category is recorded. Payment is calculated instantly.",
                  icon: Scale,
                  color: "from-teal-500 to-cyan-500",
                  bg: "bg-teal-50",
                  border: "border-teal-200",
                },
                {
                  step: "03",
                  title: "Dispatch Batch",
                  desc: "Once aggregated, the godown dispatches a verified batch to a formal recycling plant.",
                  icon: TrendingUp,
                  color: "from-blue-500 to-indigo-500",
                  bg: "bg-blue-50",
                  border: "border-blue-200",
                },
                {
                  step: "04",
                  title: "Recycler Verifies",
                  desc: "The plant weighs the incoming consignment, confirms custody, and the record is sealed on-chain.",
                  icon: ShieldCheck,
                  color: "from-purple-500 to-violet-500",
                  bg: "bg-purple-50",
                  border: "border-purple-200",
                },
              ].map(({ step, title, desc, icon: Icon, color, bg, border }) => (
                <div key={step} className="flex flex-col items-center text-center gap-4">
                  <div className={`relative flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br ${color} shadow-xl`}>
                    <Icon className="h-7 w-7 text-white" />
                    <div className={`absolute -top-2 -right-2 h-6 w-6 rounded-full ${bg} border-2 ${border} flex items-center justify-center`}>
                      <span className="text-[10px] font-black text-slate-700">{step}</span>
                    </div>
                  </div>
                  <div>
                    <h3 className="text-base font-black text-slate-900 mb-2">{title}</h3>
                    <p className="text-sm text-slate-500 leading-relaxed">{desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── Benefits ────────────────────────────────────────────────────── */}
      <section className="py-20 sm:py-28 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-20 items-center">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full bg-emerald-50 border border-emerald-200 px-4 py-1.5 text-xs font-semibold text-emerald-700 mb-5">
                <Star className="h-3.5 w-3.5" /> Why DhatuSetu
              </div>
              <h2 className="text-3xl sm:text-4xl font-black tracking-tight text-slate-900 mb-6">
                Built for India&apos;s{" "}
                <span className="text-emerald-600">informal economy</span>
              </h2>
              <p className="text-slate-600 text-base leading-relaxed mb-8">
                Over 4 million people work in India&apos;s informal scrap sector. DhatuSetu is the first platform designed 
                from the ground up to bridge their work into the formal economy — with dignity, transparency, and instant payment.
              </p>
              <div className="space-y-5">
                {[
                  {
                    icon: Banknote,
                    color: "bg-emerald-100 text-emerald-700",
                    title: "Instant DBT Payment",
                    desc: "Collectors get paid immediately when their scrap is weighed. No middlemen, no delays.",
                  },
                  {
                    icon: FileCheck,
                    color: "bg-blue-100 text-blue-700",
                    title: "Verifiable Income Record",
                    desc: "Every transaction creates a formal, GST-compatible record — enabling loans and social benefits.",
                  },
                  {
                    icon: Globe,
                    color: "bg-purple-100 text-purple-700",
                    title: "No App Download",
                    desc: "Works in any browser, on any device. Even low-end phones on 2G networks.",
                  },
                  {
                    icon: ShieldCheck,
                    color: "bg-amber-100 text-amber-700",
                    title: "Ministry-Grade Security",
                    desc: "4-digit facility PINs, role-based access, and tamper-evident audit trails.",
                  },
                ].map(({ icon: Icon, color, title, desc }) => (
                  <div key={title} className="flex gap-4">
                    <div className={`h-10 w-10 rounded-xl ${color} flex items-center justify-center shrink-0`}>
                      <Icon className="h-5 w-5" />
                    </div>
                    <div>
                      <div className="font-bold text-slate-900 text-sm">{title}</div>
                      <div className="text-slate-500 text-sm mt-0.5">{desc}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Right card */}
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-br from-emerald-100 to-teal-100 rounded-3xl transform rotate-2" />
              <div className="relative bg-white rounded-3xl border border-slate-200 p-8 shadow-xl space-y-6">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold text-slate-700">Live Chain Status</span>
                  <span className="flex items-center gap-1.5 text-xs font-mono text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-1 rounded-full">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    LIVE
                  </span>
                </div>
                {[
                  { label: "Karol Bagh Godown", type: "Aggregator", weight: "128 kg", material: "COPPER", status: "Dispatched", color: "text-amber-600 bg-amber-50 border-amber-200" },
                  { label: "Dharavi Metal Co-op", type: "Aggregator", weight: "245 kg", material: "ALUMINUM", status: "Weighing", color: "text-slate-600 bg-slate-50 border-slate-200" },
                  { label: "Hindalco Smelter", type: "Recycler", weight: "1240 kg", material: "COPPER", status: "Accepted", color: "text-emerald-600 bg-emerald-50 border-emerald-200" },
                ].map((item) => (
                  <div key={item.label} className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-200">
                    <div className="flex items-center gap-3">
                      <div className={`h-2 w-2 rounded-full ${item.type === "Aggregator" ? "bg-emerald-500" : "bg-blue-500"}`} />
                      <div>
                        <div className="text-sm font-bold text-slate-900">{item.label}</div>
                        <div className="text-xs text-slate-500">{item.type} • {item.weight}</div>
                      </div>
                    </div>
                    <div className={`text-xs font-bold px-2.5 py-1 rounded-full border ${item.color}`}>
                      {item.status}
                    </div>
                  </div>
                ))}
                <div className="pt-2 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
                  <span>3 active chains · 2 pending verification</span>
                  <span className="font-mono text-emerald-600">Updated now</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── CTA Banner ─────────────────────────────────────────────────── */}
      <section className="py-20 hero-gradient relative overflow-hidden">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-0 left-1/4 w-64 h-64 rounded-full bg-emerald-500/10 blur-3xl" />
          <div className="absolute bottom-0 right-1/4 w-64 h-64 rounded-full bg-teal-500/10 blur-3xl" />
        </div>
        <div className="relative max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-7">
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black text-white tracking-tight">
            Ready to access your terminal?
          </h2>
          <p className="text-slate-300 text-lg max-w-xl mx-auto">
            Sign in with your role and facility code to get started.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/login"
              className="group inline-flex items-center gap-2.5 px-8 py-4 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-bold text-base shadow-xl hover:shadow-2xl transition-all duration-200 active:scale-95"
            >
              Sign In Now
              <ArrowRight className="h-5 w-5 group-hover:translate-x-1 transition-transform" />
            </Link>
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-2 px-8 py-4 rounded-2xl glass text-white font-semibold text-base hover:bg-white/15 transition-all duration-200"
            >
              <BarChart3 className="h-5 w-5 text-emerald-400" />
              MoM Dashboard
            </Link>
          </div>
        </div>
      </section>

      {/* ── Footer ─────────────────────────────────────────────────────── */}
      <footer className="bg-slate-900 text-slate-400">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-10">
            {/* Brand */}
            <div className="md:col-span-2">
              <div className="flex items-center gap-3 mb-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-600 to-teal-700">
                  <Recycle className="h-5 w-5 text-white" />
                </div>
                <div>
                  <span className="text-lg font-black text-white tracking-tight">
                    Dhatu<span className="text-emerald-400">Setu</span>
                  </span>
                  <div className="text-[10px] text-slate-500 font-medium uppercase tracking-wider">Ministry of Mines</div>
                </div>
              </div>
              <p className="text-sm leading-relaxed text-slate-500 max-w-xs">
                Critical Mineral Traceability Network — connecting informal scrap collectors to India&apos;s formal recycling economy.
              </p>
            </div>

            {/* Platform */}
            <div>
              <h4 className="text-xs font-bold uppercase tracking-widest text-slate-300 mb-4">Platform</h4>
              <ul className="space-y-2.5 text-sm">
                {["Aggregator Terminal", "Recycler Portal", "MoM Dashboard", "Inventory"].map((l) => (
                  <li key={l}>
                    <Link href="/login" className="hover:text-emerald-400 transition-colors">{l}</Link>
                  </li>
                ))}
              </ul>
            </div>

            {/* Government */}
            <div>
              <h4 className="text-xs font-bold uppercase tracking-widest text-slate-300 mb-4">Government</h4>
              <ul className="space-y-2.5 text-sm">
                {["Ministry of Mines", "CMTN Policy", "DBT Framework", "Compliance"].map((l) => (
                  <li key={l}>
                    <span className="hover:text-emerald-400 transition-colors cursor-default">{l}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="border-t border-slate-800 pt-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-600">
            <span>© 2024 Dhatu Setu · Government of India, Ministry of Mines · Critical Mineral Traceability Network</span>
            <span className="font-mono text-emerald-700">SIH 2024 · CMTN v1.0</span>
          </div>
        </div>
      </footer>
    </div>
  )
}
