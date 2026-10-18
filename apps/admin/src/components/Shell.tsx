"use client";
import {Brand} from "@/components/Brand";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Home,
  Tag,
  Plus,
  LayoutGrid,
  LogOut,
  Menu,
  X,
  ArrowLeft,
} from "lucide-react";
import { useAdmin } from "./AdminContext";

export function Shell({ children }: { children: ReactNode }) {
  const store = useAdmin();
  const router = useRouter();
  const path = usePathname();
  const [menu, setMenu] = useState(false);
  useEffect(() => {
    if (store.ready !== false && !store.signedIn) router.replace("/login");
  }, [store.signedIn, store.ready, router]);
  if (store.ready === false || !store.signedIn)
    return (
      <main className="loading-screen" role="status">
        פותחים את החנות…
      </main>
    );
  const navigation = [
    { href: "/", label: "בית", icon: Home },
    { href: "/products", label: "המוצרים שלי", icon: Tag },
    { href: "/products/new", label: "הוספת מוצר", icon: Plus },
    { href: "/about", label: "אודות", icon: Home },
    { href: "/categories", label: "אפשרויות הקטלוג", icon: LayoutGrid },
  ];
  return (
    <div className="app-shell">
      <header className="mobile-header">
        <button
          className="icon-button"
          aria-label="פתיחת תפריט"
          onClick={() => setMenu(true)}
        >
          <Menu size={22} />
        </button>
        <span className="wordmark" dir="ltr">
          <Brand />
        </span>
        <span className="avatar small">א</span>
      </header>
      {menu && (
        <button
          className="nav-overlay"
          aria-label="סגירת תפריט"
          onClick={() => setMenu(false)}
        />
      )}
      <aside
        className={`sidebar ${menu ? "open" : ""}`}
        aria-label="ניווט ראשי"
      >
        <div className="sidebar-brand">
          <span className="wordmark" dir="ltr">
            <Brand />
          </span>
          <button
            className="icon-button mobile-only"
            aria-label="סגירת תפריט"
            onClick={() => setMenu(false)}
          >
            <X size={20} />
          </button>
        </div>
        <p className="sidebar-caption">המרחב של החנות שלך</p>
        <nav>
          {navigation.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              onClick={() => setMenu(false)}
              className={
                path === href ||
                (href === "/products" && path === "/products/edit")
                  ? "active"
                  : ""
              }
              aria-current={path === href ? "page" : undefined}
            >
              <Icon size={19} strokeWidth={1.4} />
              {label}
            </Link>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="owner">
            <span className="avatar">א</span>
            <div>
              שלום, בעלת החנות<span dir="ltr"><Brand /></span>
            </div>
          </div>
          <button
            className="logout"
            data-logout
            onClick={async () => {
              try {
                await store.logout();
                router.replace("/login");
              } catch {
                store.notify("היציאה נכשלה. נסי שוב.", "error");
              }
            }}
          >
            <LogOut size={17} />
            יציאה מהמערכת
            <ArrowLeft size={15} />
          </button>
        </div>
      </aside>
      <main className="workspace">
        <div className="demo-banner">
          <span className="demo-dot" />
          {process.env.NEXT_PUBLIC_ADMIN_LOCAL_PROOF === "1"
            ? "סביבת בדיקה מקומית · הנתונים דרך שרת מאובטח"
            : "הדגמה מקומית · הנתונים לדוגמה ומתאפסים ברענון"}
          <span className="demo-label" dir="ltr">
            UI PREVIEW
          </span>
        </div>
        {children}
        <footer className="workspace-footer">
          <span dir="ltr"><Brand /></span>
          <span>כל הפריטים שלך. במקום אחד.</span>
        </footer>
      </main>
    </div>
  );
}
