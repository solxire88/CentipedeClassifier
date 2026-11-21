import type { Metadata } from "next";
import { Suspense } from "react";
import { Geist, Geist_Mono, Instrument_Serif } from "next/font/google";
import "./globals.css";
import { BackendProvider } from "@/components/backend";
import { NavBar, Footer } from "@/components/shell";
import { ToastProvider } from "@/components/ui";
import { TourProvider } from "@/components/tour";

const geist = Geist({ variable: "--font-geist", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });
const instrument = Instrument_Serif({ variable: "--font-instrument", subsets: ["latin"], weight: "400" });

export const metadata: Metadata = {
  title: "CentipedeClassifier",
  description: "Predict the class and family of a drug from its DART-MS spectrum.",
};

const themeScript = `try{var t=localStorage.getItem("theme")||(matchMedia("(prefers-color-scheme: light)").matches?"light":"dark");document.documentElement.setAttribute("data-theme",t)}catch(e){document.documentElement.setAttribute("data-theme","dark")}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-theme="dark" suppressHydrationWarning className={`${geist.variable} ${geistMono.variable} ${instrument.variable}`}>
      <head><script dangerouslySetInnerHTML={{ __html: themeScript }} /></head>
      <body className="min-h-screen flex flex-col">
        <a className="skip" href="#main">Skip to content</a>
        <ToastProvider>
          <BackendProvider>
            <Suspense fallback={<div style={{ height: "var(--nav-height)" }} />}>
              <TourProvider>
                <NavBar />
                <main id="main" tabIndex={-1} className="flex-1" style={{ outline: "none" }}>{children}</main>
                <Footer />
              </TourProvider>
            </Suspense>
          </BackendProvider>
        </ToastProvider>
      </body>
    </html>
  );
}
