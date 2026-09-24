"use client";

import { CircleAlert, MailCheck } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useActionState, useId } from "react";
import { sendMagicLink, signIn, signUp, type AuthState } from "@/app/(auth)/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const initial: AuthState = { status: "idle" };

export function AuthForm({ mode }: { mode: "sign-in" | "sign-up" }) {
  const t = useTranslations("auth");
  const tc = useTranslations("common");
  const [state, action, pending] = useActionState(mode === "sign-in" ? signIn : signUp, initial);
  const [linkState, linkAction, linkPending] = useActionState(sendMagicLink, initial);
  const emailId = useId();
  const passwordId = useId();
  const errorId = useId();

  const shown = linkState.status !== "idle" ? linkState : state;

  if (shown.status === "check-email" || shown.status === "link-sent") {
    return (
      <div role="status" className="rounded-xl bg-secondary p-6 text-secondary-foreground">
        <MailCheck className="mb-3 size-7" aria-hidden="true" />
        <p className="text-base font-semibold">
          {shown.status === "check-email" ? t("checkEmail") : t("magicLinkSent", { email: shown.email })}
        </p>
      </div>
    );
  }

  const error = shown.status === "error" ? shown : null;
  const errorText = error
    ? error.error === "setup"
      ? tc("setupRequiredBody")
      : t(`errors.${error.error}`)
    : null;
  const defaultEmail = error?.email ?? "";

  return (
    <form action={action} className="space-y-5" noValidate>
      {errorText && (
        <p
          id={errorId}
          role="alert"
          className="flex gap-2 rounded-md bg-destructive/10 px-3 py-2.5 text-sm text-destructive"
        >
          <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          {errorText}
        </p>
      )}

      <div className="space-y-2">
        <Label htmlFor={emailId}>{t("email")}</Label>
        <Input
          id={emailId}
          name="email"
          type="email"
          autoComplete="email"
          inputMode="email"
          required
          defaultValue={defaultEmail}
          aria-invalid={error?.field === "email" || undefined}
          aria-describedby={`${emailId}-hint${errorText ? ` ${errorId}` : ""}`}
        />
        {mode === "sign-up" && (
          <p id={`${emailId}-hint`} className="text-xs text-muted-foreground">
            {t("emailHint")}
          </p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor={passwordId}>{t("password")}</Label>
        <Input
          id={passwordId}
          name="password"
          type="password"
          autoComplete={mode === "sign-in" ? "current-password" : "new-password"}
          required
          minLength={8}
          aria-invalid={error?.field === "password" || undefined}
          aria-describedby={`${passwordId}-hint`}
        />
        <p id={`${passwordId}-hint`} className="text-xs text-muted-foreground">
          {t("passwordHint")}
        </p>
      </div>

      <Button type="submit" size="lg" className="w-full" disabled={pending || linkPending}>
        {mode === "sign-in"
          ? pending
            ? t("signingIn")
            : t("signIn")
          : pending
            ? t("signingUp")
            : t("signUp")}
      </Button>

      {mode === "sign-in" && (
        <Button
          type="submit"
          formAction={linkAction}
          formNoValidate
          variant="outline"
          size="lg"
          className="w-full"
          disabled={pending || linkPending}
        >
          {t("magicLink")}
        </Button>
      )}

      <p className="text-center text-sm text-muted-foreground">
        {mode === "sign-in" ? t("noAccount") : t("haveAccount")}{" "}
        <Link
          href={mode === "sign-in" ? "/sign-up" : "/sign-in"}
          className="font-semibold text-primary underline-offset-4 hover:underline"
        >
          {mode === "sign-in" ? t("goSignUp") : t("goSignIn")}
        </Link>
      </p>
    </form>
  );
}
