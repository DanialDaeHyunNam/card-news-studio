"use client";

// Renderer side of the desktop shell. electron/preload.ts exposes
// window.cardnewsDesktop; its presence is how the UI knows it's in the app.
// Shapes mirror electron/license.ts + electron/updater.ts (kept as plain types
// here so the web bundle never imports electron code).
import { useEffect, useState } from "react";

export interface DesktopLicense {
  state: "none" | "active" | "expired" | "disabled" | "wrong-product";
  plan?: "byo" | "plus";
  keyMasked?: string;
  offlineUntil?: string;
  trialStartedAt?: string;
  trialEndsAt?: string;
  trialActive: boolean;
  entitled: boolean;
  official: boolean;
  buyUrl: string;
  error?: string;
}

export interface DesktopUpdate {
  phase: "idle" | "checking" | "available" | "downloading" | "ready" | "error";
  version: string;
  newVersion?: string;
  percent?: number;
  error?: string;
  disabled?: boolean;
}

interface DesktopBridge {
  platform: string;
  license: {
    info(): Promise<DesktopLicense>;
    activate(key: string): Promise<DesktopLicense>;
    deactivate(): Promise<DesktopLicense>;
    onChange(fn: (v: unknown) => void): () => void;
  };
  update: {
    status(): Promise<DesktopUpdate>;
    check(): Promise<DesktopUpdate>;
    install(): Promise<void>;
    onStatus(fn: (v: unknown) => void): () => void;
  };
  openExternal(url: string): Promise<void>;
  openDataFolder(): Promise<void>;
  info(): Promise<{ version: string; dataDir: string; official: boolean }>;
  wipeData(): Promise<number>;
  relaunch(): Promise<void>;
}

export function getDesktop(): DesktopBridge | null {
  if (typeof window === "undefined") return null;
  return (window as unknown as { cardnewsDesktop?: DesktopBridge }).cardnewsDesktop ?? null;
}

export const isDesktop = (): boolean => getDesktop() !== null;

// Live license + update status (null outside the desktop app).
export function useDesktopStatus() {
  const [license, setLicense] = useState<DesktopLicense | null>(null);
  const [update, setUpdate] = useState<DesktopUpdate | null>(null);
  useEffect(() => {
    const d = getDesktop();
    if (!d) return;
    void d.license.info().then(setLicense);
    void d.update.status().then(setUpdate);
    const offL = d.license.onChange((v) => setLicense(v as DesktopLicense));
    const offU = d.update.onStatus((v) => setUpdate(v as DesktopUpdate));
    return () => {
      offL();
      offU();
    };
  }, []);
  return { license, setLicense, update };
}

export function daysLeft(iso?: string): number {
  if (!iso) return 0;
  return Math.max(0, Math.ceil((new Date(iso).getTime() - Date.now()) / 86_400_000));
}
