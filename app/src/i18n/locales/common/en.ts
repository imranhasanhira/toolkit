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
    verifyEmailOk: "If everything is okay,",
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
  apps: {
    onlineJudge: "Online Judge",
    sokafilm: "SokaFilm",
    redditBot: "Reddit Bot",
    carely: "Carely",
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
    subscription: {
      pastDue:
        "Payment for your {{plan}} plan is past due! Please update your subscription payment information.",
      cancelAtPeriodEnd:
        "Your {{plan}} plan subscription has been canceled, but remains active until the end of the current billing period: {{endDate}}",
      deleted:
        "Your previous subscription has been canceled and is no longer active.",
    },
  },
  notFound: {
    heading: "404",
    description: "Oops! The page you're looking for doesn't exist.",
    goBackHome: "Go Back Home",
  },
  cookieConsent: {
    title: "We use cookies",
    description:
      "We use cookies primarily for analytics to enhance your experience. By accepting, you agree to our use of these cookies. You can manage your preferences or learn more about our cookie policy.",
    acceptAll: "Accept all",
    rejectAll: "Reject all",
    privacyPolicy: "Privacy Policy",
    termsAndConditions: "Terms and Conditions",
  },
} as const;

export default en;
