import "./globals.css";
import { Toaster } from "react-hot-toast";

export const metadata = {
  title: "Gold Adam CRM",
  description: "Bookings viewer + two-way sync for Gold Adam routes",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        {children}
        <Toaster position="top-right" />
      </body>
    </html>
  );
}
