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
    noAccountPrompt: "Don't have an account yet?",
    goToSignup: "go to signup",
    forgotPassword: "Forgot your password?",
    resetIt: "reset it",
    haveAccountPrompt: "I already have an account",
    goToLogin: "go to login",
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
  userMenu: {
    accountSettings: "Account Settings",
    adminDashboard: "Admin Dashboard",
  },
  account: {
    title: "Account Information",
    email: "Email address",
    username: "Username",
    yourPlan: "Your Plan",
    credits: "Credits",
    credits_one: "{{count}} credit",
    credits_other: "{{count}} credits",
    about: "About",
    aboutValue: "I'm a cool customer.",
    appAccess: "Your app access",
    none: "None",
    freePlan: "Free Plan",
  },
} as const;

export default en;
