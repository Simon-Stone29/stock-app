"use client";
import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/src/lib/utils";
import { Sheet, SheetContent, SheetTrigger } from "@/src/components/ui/sheet";
import { Menu } from "lucide-react";

const links = [
  { href: "/", label: "My Picks" },
  { href: "/group-portfolio", label: "Group Portfolio" },
  { href: "/leaderboard", label: "Leaderboard" },
  { href: "/about", label: "About" },
];

export function AppNavbar() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <nav className="sticky top-0 z-40 border-b border-border bg-background/90 backdrop-blur">
      <div className="mx-auto flex h-16 w-full max-w-full items-center justify-between px-4">
        <Link href="/" className="text-xl font-semibold tracking-wide">
          Alpha<span className="text-primary">Pool</span>
        </Link>
        
        {/* Desktop Nav */}
        <div className="hidden md:flex items-center gap-1">
          {links.map((link) => (
            <NavLink key={link.href} link={link} pathname={pathname} />
          ))}
        </div>

        {/* Mobile Nav */}
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild className="md:hidden">
            <button className="p-2">
              <Menu className="h-6 w-6" />
            </button>
          </SheetTrigger>
          <SheetContent side="right">
            <div className="flex flex-col gap-4 mt-8">
              {links.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setOpen(false)}
                  className={cn(
                    "text-lg transition-colors",
                    pathname === link.href
                      ? "font-semibold text-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {link.label}
                </Link>
              ))}
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </nav>
  );
}

function NavLink({ link, pathname }: { link: typeof links[0]; pathname: string }) {
  const active = pathname === link.href;
  return (
    <Link
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
}