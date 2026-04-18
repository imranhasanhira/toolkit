/**
 * `common` namespace — bundled statically into the initial JS so core UI
 * renders without a network round-trip. Kept as a TypeScript module (rather
 * than a JSON file) because the Wasp SDK's tsconfig disables
 * `resolveJsonModule`. Subapp namespaces stay as JSON and are lazy-loaded.
 */
const en = {
  actions: {
    save: "Save",
    cancel: "Cancel",
    delete: "Delete",
    edit: "Edit",
    close: "Close",
    confirm: "Confirm",
    back: "Back",
    next: "Next",
    submit: "Submit",
    retry: "Retry",
  },
  auth: {
    logIn: "Log in",
    logOut: "Log out",
    signUp: "Sign up",
    account: "Account",
    settings: "Settings",
  },
  status: {
    loading: "Loading...",
    saving: "Saving...",
    saved: "Saved",
    noData: "No data",
  },
  errors: {
    generic: "Something went wrong. Please try again.",
    network: "Network error. Check your connection.",
    unauthorized: "You need to be logged in to do that.",
  },
  nav: {
    openMenu: "Open main menu",
    toolkit: "Toolkit",
  },
} as const;

export default en;
