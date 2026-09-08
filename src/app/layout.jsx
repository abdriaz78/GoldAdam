import "./globals.css";
import { Fraunces, Inter } from "next/font/google";
import { Toaster } from "react-hot-toast";

const fraunces = Fraunces({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-fraunces",
  display: "swap",
});

const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata = {
  title: "Goldroute",
  description: "Bookings viewer + two-way sync for Gold Adam routes",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={`${fraunces.variable} ${inter.variable}`}>
      <body>
        {children}
        <Toaster
          position="top-right"
          toastOptions={{
            style: {
              background: "#212A36",
              color: "#EEF1F5",
              border: "1px solid #2A3341",
              fontSize: "13px",
            },
            success: { iconTheme: { primary: "#4F9D6E", secondary: "#212A36" } },
            error: { iconTheme: { primary: "#C1554B", secondary: "#212A36" } },
          }}
        />
      </body>
    </html>
  );
}
