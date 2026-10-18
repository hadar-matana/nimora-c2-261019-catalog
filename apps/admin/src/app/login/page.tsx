"use client";
import {Brand} from "@/components/Brand";

import { useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, ArrowLeft, LockKeyhole } from "lucide-react";
import { useAdmin } from "@/components/AdminContext";
import { mockCredentials, normalizeMockInput } from "@/lib/mock-auth";

export default function LoginPage() {
  const proof = process.env.NEXT_PUBLIC_ADMIN_LOCAL_PROOF === "1";
  const { login } = useAdmin();
  const router = useRouter();
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const submitting = useRef(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting.current) return;
    const form = new FormData(event.currentTarget);
    // Read DOM values at submit time, including browser autofill and paste.
    const username = normalizeMockInput(String(form.get("username") ?? ""));
    const rawPassword = String(form.get("password") ?? "");
    const password = proof ? rawPassword : normalizeMockInput(rawPassword);
    if (!username || !password) {
      setError("יש למלא שם משתמש וסיסמה");
      return;
    }
    submitting.current = true;
    setBusy(true);
    setError("");
    await new Promise((resolve) => setTimeout(resolve, 350));
    try {
      if (await login(username, password)) router.push("/");
      else {
        setError("שם המשתמש או הסיסמה אינם נכונים. נסי שוב.");
        setBusy(false);
        submitting.current = false;
      }
    } catch (failure) {
      setError(
        failure instanceof Error ? failure.message : "הכניסה נכשלה. נסי שוב.",
      );
      setBusy(false);
      submitting.current = false;
    }
  }
  return (
    <main className="login-page">
      <section className="login-form-panel">
        <div className="login-inner">
          <span className="wordmark login-wordmark" dir="ltr">
            <Brand />
          </span>
          <div className="login-title">
            <span className="eyebrow">ניהול החנות שלך</span>
            <h1>טוב לראות אותך.</h1>
            <p>
              המוצרים, התמונות והפרטים הקטנים —<br />
              הכול מחכה לך כאן.
            </p>
          </div>
          <form onSubmit={submit} noValidate>
            <label htmlFor="username">שם משתמש</label>
            <input
              id="username"
              name="username"
              autoComplete="username"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              dir="ltr"
              placeholder="שם המשתמש שלך"
              aria-describedby={error ? "login-error" : undefined}
            />
            <label htmlFor="password">סיסמה</label>
            <div className="password-field">
              <input
                id="password"
                name="password"
                type={show ? "text" : "password"}
                autoComplete="current-password"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                dir="ltr"
                placeholder="הסיסמה שלך"
                aria-describedby={error ? "login-error" : undefined}
              />
              <button
                type="button"
                className="icon-button"
                aria-label={show ? "הסתרת סיסמה" : "הצגת סיסמה"}
                aria-pressed={show}
                onClick={() => setShow(!show)}
              >
                {show ? <EyeOff size={19} /> : <Eye size={19} />}
              </button>
            </div>
            {error && (
              <p className="field-error" id="login-error" role="alert">
                {error}
              </p>
            )}
            <button className="button primary login-submit" disabled={busy}>
              {busy ? "נכנסים…" : "כניסה לחנות"}
              <ArrowLeft size={18} />
            </button>
          </form>
          <div className="login-demo">
            <LockKeyhole size={17} />
            <div>
              <strong>
                {proof ? "בדיקת תאימות מקומית" : "הדגמה מקומית בלבד"}
              </strong>
              <p>
                {proof ? (
                  <>
                    כניסה באמצעות החשבון שהוגדר מקומית. אין להשתמש בסיסמה של
                    שירות אחר.
                  </>
                ) : (
                  <>
                    כניסה לדוגמה: <bdi>{mockCredentials.username}</bdi> /{" "}
                    <bdi>{mockCredentials.password}</bdi>
                    <br />
                    אין להזין פרטי כניסה אמיתיים.
                  </>
                )}
              </p>
            </div>
          </div>
          <p className="login-help">זקוקה לעזרה בכניסה? פני למנהלת המערכת.</p>
        </div>
      </section>
      <aside className="login-photo">
        <div className="login-photo-caption">
          <span dir="ltr">
            A LITTLE ORDER.
            <br />A LOT OF STYLE.
          </span>
          <p>יותר זמן ליצירה. פחות זמן לניהול.</p>
        </div>
      </aside>
    </main>
  );
}
