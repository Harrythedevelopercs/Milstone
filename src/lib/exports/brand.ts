// Central place for report branding. Every PDF/Excel export and the web
// header (nav, login) picks up the logo from here without further changes.
export const BRAND_NAME = "FoundaPay";
// Public web path (used by <img>/next/image in the nav bar and login page).
export const BRAND_LOGO_PATH: string | null = "/foundapay-logo.png";
// Purple sampled from the logo's background. Not yet applied to the app
// theme -- awaiting confirmation before changing --primary app-wide.
export const BRAND_ACCENT_COLOR = "#743CE8";
