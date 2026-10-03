"use client";

export default function ErrorPage({ reset }: { reset: () => void }) {
  return <main className="shell"><h1>Halaman belum berhasil dimuat.</h1><p>Coba lagi untuk membuka Slipboxd.</p><button onClick={reset}>Coba lagi</button></main>;
}
