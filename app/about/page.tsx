"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
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
  const [showWave, setShowWave] = useState(true);
  const [showContent, setShowContent] = useState(false);

  const finishSplash = () => {
    setShowContent(true);
    setShowWave(false);
  };

  return (
    <div>
      {showWave && (
        <video
          autoPlay
          muted
          playsInline
          preload="auto"
          aria-hidden="true"
          onTimeUpdate={(event) => {
            const video = event.currentTarget;
            if (
              Number.isFinite(video.duration) &&
              video.duration > 0 &&
              video.currentTime >= video.duration - 0.6
            ) {
              setShowContent(true);
            }
          }}
          onEnded={finishSplash}
          onError={finishSplash}
          className="pointer-events-none fixed inset-0 z-30 h-dvh w-full object-cover mix-blend-screen"
        >
          <source src="/wave_transparent.webm" type="video/webm" />
        </video>
      )}

      <div className={showContent ? "block" : "hidden"}>
      {/* How it works */}
      <section className="mx-auto max-w-5xl px-4 py-24 md:pl-12">
        <div className="grid gap-12 md:grid-cols-[minmax(0,0.8fr)_minmax(0,1fr)] md:items-center">
          <div>
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
          </div>

          <Reveal className="relative z-10 mx-auto h-[min(84svh,52.8rem)] min-h-96 w-full max-w-[38.4rem] overflow-visible rounded-lg md:translate-x-[calc(15vw-7rem)] xl:translate-x-[calc(15vw-4rem)] lg:mt-0">
            <Image
              src="/alphapool_phone.png"
              alt="AlphaPool portfolio displayed on a phone"
              fill
              unoptimized
              sizes="(min-width: 1024px) 40vw, 100vw"
              className="object-contain scale-150"
            />
          </Reveal>
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
    </div>
  );
}