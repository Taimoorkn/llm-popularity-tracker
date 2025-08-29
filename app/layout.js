import { Inter, Sora, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: 'swap',
});

const sora = Sora({
  variable: "--font-sora",
  subsets: ["latin"],
  display: 'swap',
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  display: 'swap',
});

export const metadata = {
  title: "LLM Popularity Tracker 2025 | Vote for the Best AI Models",
  description: "Vote for your favorite Large Language Models and see real-time community rankings. Compare GPT-4o, Claude 3.5, Gemini Ultra, Llama 3 and more AI models in 2025.",
  keywords: "LLM, Large Language Models, AI voting, GPT-4, Claude, Gemini, artificial intelligence, AI comparison, machine learning, 2025",
  authors: [{ name: "AI Community" }],
  creator: "AI Community",
  publisher: "LLM Popularity Tracker",
  robots: {
    index: true,
    follow: true,
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "https://llm-popularity-tracker.vercel.app",
    title: "LLM Popularity Tracker 2025 | Vote for the Best AI Models",
    description: "Vote for your favorite Large Language Models and see real-time community rankings. Compare GPT-4o, Claude 3.5, Gemini Ultra, Llama 3 and more AI models.",
    siteName: "LLM Popularity Tracker",
  },
  twitter: {
    card: "summary_large_image",
    title: "LLM Popularity Tracker 2025",
    description: "Vote for your favorite Large Language Models and see real-time community rankings.",
  },
  viewport: {
    width: "device-width",
    initialScale: 1,
    maximumScale: 1,
  },
  themeColor: "#7c3aed",
  colorScheme: "dark",
};

export default function RootLayout({ children }) {
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    "name": "LLM Popularity Tracker 2025",
    "description": "Vote for your favorite Large Language Models and see real-time community rankings",
    "url": "https://llm-popularity-tracker.vercel.app",
    "applicationCategory": "Utility",
    "operatingSystem": "Any",
    "offers": {
      "@type": "Offer",
      "price": "0",
      "priceCurrency": "USD"
    },
    "author": {
      "@type": "Organization",
      "name": "AI Community"
    }
  }

  return (
    <html lang="en" className="dark">
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(structuredData),
          }}
        />
      </head>
      <body
        className={`${inter.variable} ${sora.variable} ${jetbrainsMono.variable} antialiased bg-background text-foreground font-inter`}
      >
        {children}
      </body>
    </html>
  );
}
