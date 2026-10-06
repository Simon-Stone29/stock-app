"use client";
import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { cn } from "@/src/lib/utils";

const links = [
  { href: "/", label: "My Picks" },
  { href: "/group-portfolio", label: "Group Portfolio" },
  { href: "/leaderboard", label: "Leaderboard" },
  { href: "/about", label: "About" },
];

export function AppNavbar() {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);

  return (
    <nav className="sticky top-0 z-40 border-b border-border bg-background/90 backdrop-blur">
      <div className="mx-auto flex h-16 w-full max-w-full items-center justify-between px-4">
        <Link href="/" className="flex items-center gap-2 text-xl font-semibold tracking-wide">
          <span>
            Alpha<span className="text-primary">Pool</span>
          </span>
          <Image
            src="/alphapoollogo2.png"
            alt=""
            width={25}
            height={25}
            className="h-[25px] w-[25px] object-contain"
          />
        </Link>
        
        {/* Desktop Nav */}
        <div className="hidden md:flex items-center gap-1">
          {links.map((link) => {
            const active = pathname === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  "rounded-md px-2 py-1 text-sm transition-colors",
                  active
                    ? "bg-muted text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {link.label}
              </Link>
            );
          })}
        </div>

        {/* Mobile Menu Button */}
        <button
          className="md:hidden p-2 rounded-md hover:bg-muted"
          onClick={() => setIsOpen(!isOpen)}
        >
          <span className="block w-5 h-0.5 bg-foreground mb-1.5"></span>
          <span className="block w-5 h-0.5 bg-foreground mb-1.5"></span>
          <span className="block w-5 h-0.5 bg-foreground"></span>
        </button>
      </div>

      {/* Mobile Nav Menu */}
      {isOpen && (
        <div className="md:hidden border-t border-border bg-background">
          <div className="flex flex-col gap-0 px-4 py-2">
            {links.map((link) => {
              const active = pathname === link.href;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setIsOpen(false)}
                  className={cn(
                    "px-2 py-2 rounded-md transition-colors",
                    active
                      ? "bg-muted text-foreground font-semibold"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted"
                  )}
                >
                  {link.label}
                </Link>
              );
            })}
          </div>
        </div>
      )}
    </nav>
  );
}