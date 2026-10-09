/**
 * OM Mobile Art — Storefront Tailwind Configuration (tailwind-config-shop.js)
 * Centralized design tokens for storefront pages based on the Official Brand Palette.
 */
tailwind.config = {
  darkMode: "class",
  theme: {
    extend: {
      "colors": {
        "footer-bg": "#03045E",
        "inverse-surface": "#03045E",
        "on-tertiary": "#ffffff",
        "secondary-fixed": "#e5e7eb",
        "surface-variant": "#e5e7eb",
        "on-error": "#ffffff",
        "background": "#F8FAFC",
        "on-primary": "#ffffff",
        "inverse-on-surface": "#f8fafc",
        "surface-container-low": "#f8fafc",
        "surface-dim": "#e5e7eb",
        "tertiary-container": "#90E0EF",
        "on-primary-fixed": "#111827",
        "text-muted": "#6B7280",
        "primary-fixed-dim": "#90E0EF",
        "on-secondary-container": "#6B7280",
        "on-background": "#111827",
        "secondary": "#0077B6",
        "on-secondary": "#ffffff",
        "inverse-primary": "#90E0EF",
        "border-subtle": "#E5E7EB",
        "primary": "#03045E",
        "primary-hover": "#0077B6",
        "accent-sky": "#00B4D8",
        "light-cyan": "#90E0EF",
        "very-light-cyan": "#CAF0F8",
        "error": "#EF4444",
        "success": "#22C55E",
        "warning": "#F59E0B",
        "surface-container-lowest": "#ffffff",
        "on-surface": "#111827",
        "surface-container": "#e5e7eb",
        "badge-best": "#03045E",
        "primary-fixed": "#90E0EF",
        "on-tertiary-fixed": "#111827",
        "secondary-fixed-dim": "#e5e7eb",
        "tertiary": "#00B4D8",
        "on-secondary-fixed": "#111827",
        "on-primary-container": "#ffffff",
        "surface": "#F8FAFC",
        "badge-new": "#00B4D8",
        "on-error-container": "#93000a",
        "on-primary-fixed-variant": "#03045E",
        "outline-variant": "#E5E7EB",
        "on-surface-variant": "#6B7280",
        "badge-sale": "#0077B6",
        "surface-container-high": "#e5e7eb",
        "on-secondary-fixed-variant": "#6B7280",
        "tertiary-fixed": "#90E0EF",
        "tertiary-fixed-dim": "#90E0EF",
        "accent-hover": "#0077B6",
        "on-tertiary-fixed-variant": "#6B7280",
        "primary-container": "#0077B6",
        "on-tertiary-container": "#111827",
        "surface-bright": "#ffffff",
        "text-secondary": "#6B7280",
        "outline": "#E5E7EB",
        "surface-container-highest": "#e5e7eb",
        "surface-tint": "#03045E",
        "error-container": "#fee2e2",
        "secondary-container": "#e5e7eb"
      },
      "borderRadius": {
        "DEFAULT": "0.25rem",
        "lg": "0.5rem",
        "xl": "0.75rem",
        "full": "9999px"
      },
      "spacing": {
        "container-max-width": "1450px",
        "stack-lg": "32px",
        "topbar-height": "36px",
        "stack-sm": "8px",
        "gutter": "32px",
        "header-height": "72px",
        "section-padding": "80px",
        "stack-md": "16px"
      },
      "fontFamily": {
        "body-main": ["DM Sans"],
        "headline-h1": ["DM Sans"],
        "label-caps": ["DM Sans"],
        "headline-h3": ["DM Sans"],
        "button-text": ["DM Sans"],
        "headline-h2": ["DM Sans"]
      },
      "fontSize": {
        "body-main": ["15px", {"lineHeight": "1.65", "fontWeight": "400"}],
        "headline-h1": ["48px", {"lineHeight": "1.1", "letterSpacing": "-0.02em", "fontWeight": "700"}],
        "label-caps": ["12px", {"lineHeight": "1", "letterSpacing": "0.08em", "fontWeight": "500"}],
        "headline-h3": ["22px", {"lineHeight": "1.3", "fontWeight": "600"}],
        "button-text": ["14px", {"lineHeight": "1", "fontWeight": "600"}],
        "headline-h2": ["32px", {"lineHeight": "1.2", "letterSpacing": "-0.01em", "fontWeight": "600"}]
      }
    }
  }
};
