
if (typeof window !== "undefined" && window.tailwind) {
  window.tailwind.config = {
    theme: {
      extend: {
        fontFamily: {
          vazir: ["Vazirmatn", "Tahoma", "Segoe UI", "sans-serif"],
          inter: ["Inter", "Segoe UI", "Roboto", "Arial", "sans-serif"],
        },
        animation: {
          "pulse-slow": "pulse 4s cubic-bezier(0.4, 0, 0.6, 1) infinite",
          float: "float 7s ease-in-out infinite",
          "fade-in": "fadeIn 0.55s ease-out",
          glow: "glow 2.8s ease-in-out infinite",
        },
        keyframes: {
          float: {
            "0%,100%": { transform: "translateY(0)" },
            "50%": { transform: "translateY(-10px)" },
          },
          fadeIn: {
            "0%": { opacity: "0", transform: "translateY(10px)" },
            "100%": { opacity: "1", transform: "translateY(0)" },
          },
          glow: {
            "0%,100%": { filter: "brightness(1) saturate(1)" },
            "50%": { filter: "brightness(1.12) saturate(1.15)" },
          },
        },
      },
    },
  };
}
    
