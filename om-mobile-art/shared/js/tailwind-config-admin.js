/**
 * OM Mobile Art — Admin Panel Tailwind Configuration (tailwind-config-admin.js)
 * Centralized design tokens for admin pages based on the Official Brand Palette.
 */
tailwind.config = {
  darkMode: "class",
  theme: {
    extend: {
      "colors": {
        "primary": "#03045E",
        "primary-hover": "#0077B6",
        "secondary": "#0077B6",
        "accent-sky": "#00B4D8",
        "light-cyan": "#90E0EF",
        "very-light-cyan": "#CAF0F8",
        "surface": "#F8FAFC",
        "on-surface": "#111827",
        "surface-dim": "#E5E7EB",
        "surface-bright": "#F8FAFC",
        "surface-container-lowest": "#FFFFFF",
        "surface-container-low": "#F8FAFC",
        "surface-container": "#E5E7EB",
        "surface-container-high": "#E5E7EB",
        "surface-container-highest": "#E5E7EB",
        "outline": "#E5E7EB",
        "outline-variant": "#E5E7EB",
        "inverse-surface": "#03045E",
        "sidebar-bg": "#03045E",
        "sidebar-active": "#00B4D8",
        "sidebar-hover": "#0077B6",
        "sidebar-text": "#FFFFFF",
        "active-text": "#90E0EF",
        "success": "#22C55E",
        "warning": "#F59E0B",
        "error": "#EF4444",
        "info": "#0077B6"
      },
      "borderRadius": {
        "DEFAULT": "8px",
        "lg": "8px",
        "xl": "12px",
        "full": "9999px"
      },
      "spacing": {
        "sidebar_width": "240px",
        "grid_gutter": "20px",
        "stack_gap": "16px",
        "header_height": "60px",
        "container_padding": "24px"
      },
      "fontFamily": {
        "sans": ["DM Sans", "sans-serif"],
        "page-title": ["DM Sans"],
        "data-tabular": ["DM Sans"],
        "body-sm": ["DM Sans"],
        "body-default": ["DM Sans"],
        "section-title": ["DM Sans"],
        "label-uppercase": ["DM Sans"]
      }
    }
  }
};
