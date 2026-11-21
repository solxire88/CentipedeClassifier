import "./landing.css";
import data from "@/lib/landing-data.json";
import { Landing, type LandingData } from "@/components/landing/landing";

export const metadata = {
  title: "CentipedeClassifier",
  description: "Paste a DART-MS spectrum and get a suggested drug family and class, with a confidence and an honest account of where it fails.",
};

/** The front door. Its numbers come from `lib/landing-data.json` (written by scripts/export_app_data.py), so it renders even while the backend is asleep. */
export default function Home() {
  return <Landing data={data as unknown as LandingData} />;
}
