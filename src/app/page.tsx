"use client";

import { useState } from "react";
import { SignInPage } from "@/components/ui/sign-in-flow-1";
import { AppShell } from "@/components/Dashboard";

export default function Home() {
  const [signedIn, setSignedIn] = useState(false);

  if (signedIn) {
    return <AppShell onSignOut={() => setSignedIn(false)} />;
  }

  return <SignInPage onSignedIn={() => setSignedIn(true)} />;
}
