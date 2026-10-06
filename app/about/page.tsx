"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Button } from "@/src/components/ui/button";
import { cn } from "@/src/lib/utils";

function Reveal({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.unobserve(el);
        }
      },
      { threshold: 0.2 }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={cn(
        "transition-all duration-700 ease-out",
        visible ? "translate-y-0 opacity-100" : "translate-y-8 opacity-0",
        className
      )}
    >
      {children}
    </div>
  );
}

const steps = [
  {
    number: "01",
    title: "Pick your stocks",
    description:
      "Every weekend, allocate up to 10 stocks across your portfolio however you see fit.",
  },
  {
    number: "02",
    title: "Scores update daily",
    description:
      "Your picks are scored against a Monday baseline, see how your stocks are trending, updated daily.",
  },
  {
    number: "03",
    title: "Merit shapes the group",
    description:
      "The collective portfolio weights every user's picks by their track record — better calls, more influence.",
  },
  {
    number: "04",
    title: "Climb the leaderboard",
    description:
      "Compete on a public leaderboard ranked by competence score, updated every week.",
  },
];

export default function About() {
  return (
    <div>
      {/* Hero */}
      <section className="mx-auto flex min-h-[90vh] max-w-3xl flex-col justify-center px-4">
        <span className="text-sm font-semibold uppercase tracking-widest text-foreground">
          Alpha<span className="text-primary">Pool</span>
        </span>
        <h1 className="mt-4 text-4xl font-semibold leading-[1.05] tracking-tight sm:text-6xl md:text-7xl">
          Beat the group,{" "}
          <span className="text-muted-foreground">track your stocks</span>, &amp;
          contribute to a <span className="text-primary">merit-based</span>{" "}
          collective portfolio.
        </h1>

        <div className="mt-12 flex items-center gap-2 text-xs text-muted-foreground">
          <span className="inline-flex h-8 w-5 items-start justify-center rounded-full border border-border pt-1.5">
            <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-primary" />
          </span>
          Scroll
        </div>
      </section>

      {/* How it works */}
      <section className="mx-auto max-w-2xl px-4 py-24">
        <Reveal>
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            How it works
          </h2>
        </Reveal>

        <div className="mt-8 space-y-16">
          {steps.map((step) => (
            <Reveal key={step.number} className="flex gap-6">
              <span className="tabular-nums text-sm font-semibold text-primary">
                {step.number}
              </span>
              <div>
                <h3 className="text-lg font-semibold">{step.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground">
                  {step.description}
                </p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* CTA */}
      <Reveal className="mx-auto max-w-2xl px-4 pb-32 text-center">
        <p className="text-2xl font-semibold tracking-tight">
          Ready to make your picks?
        </p>
        <Link href="/">
          <Button className="mt-6">Get started</Button>
        </Link>
      </Reveal>
    </div>
  );
}