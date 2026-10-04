import type { Metadata } from "next";
import { About } from "@/components/about";

export const metadata: Metadata = { title: "About & FAQ — Slipboxd", description: "About Slipboxd, data privacy, frequently asked questions, and credits." };

export default function AboutPage() { return <About/>; }
