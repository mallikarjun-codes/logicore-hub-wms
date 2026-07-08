/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        border: "hsl(var(--border, 240 5.9% 90%))",
        background: "hsl(var(--background, 0 0% 100%))",
        foreground: "hsl(var(--foreground, 240 10% 3.9%))",
        card: "hsl(var(--card, 0 0% 100%))",
        "card-foreground": "hsl(var(--card-foreground, 240 10% 3.9%))",
        popover: "hsl(var(--popover, 0 0% 100%))",
        "popover-foreground": "hsl(var(--popover-foreground, 240 10% 3.9%))",
        primary: "hsl(var(--primary, 240 5.9% 10%))",
        "primary-foreground": "hsl(var(--primary-foreground, 0 0% 98%))",
        secondary: "hsl(var(--secondary, 240 4.8% 95.9%))",
        "secondary-foreground": "hsl(var(--secondary-foreground, 240 5.9% 10%))",
        muted: "hsl(var(--muted, 240 4.8% 95.9%))",
        "muted-foreground": "hsl(var(--muted-foreground, 240 3.8% 46.1%))",
        accent: "hsl(var(--accent, 240 4.8% 95.9%))",
        "accent-foreground": "hsl(var(--accent-foreground, 240 5.9% 10%))",
        destructive: "hsl(var(--destructive, 0 84.2% 60.2%))",
        "destructive-foreground": "hsl(var(--destructive-foreground, 0 0% 98%))",
      }
    },
  },
  plugins: [],
}
