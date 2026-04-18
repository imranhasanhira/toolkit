/**
 * `common` namespace — Bengali. See `en.ts` for why this is a .ts module
 * rather than a JSON file.
 */
const bn = {
  actions: {
    save: "সংরক্ষণ",
    cancel: "বাতিল",
    delete: "মুছুন",
    edit: "সম্পাদনা",
    close: "বন্ধ করুন",
    confirm: "নিশ্চিত করুন",
    back: "পেছনে",
    next: "পরবর্তী",
    submit: "জমা দিন",
    retry: "আবার চেষ্টা করুন",
  },
  auth: {
    logIn: "লগ ইন",
    logOut: "লগ আউট",
    signUp: "সাইন আপ",
    account: "অ্যাকাউন্ট",
    settings: "সেটিংস",
    noAccountPrompt: "এখনো অ্যাকাউন্ট নেই?",
    goToSignup: "সাইন আপে যান",
    forgotPassword: "পাসওয়ার্ড ভুলে গেছেন?",
    resetIt: "রিসেট করুন",
    haveAccountPrompt: "আমার ইতিমধ্যে একটি অ্যাকাউন্ট আছে",
    goToLogin: "লগ ইনে যান",
  },
  status: {
    loading: "লোড হচ্ছে...",
    saving: "সংরক্ষণ হচ্ছে...",
    saved: "সংরক্ষিত",
    noData: "কোন তথ্য নেই",
  },
  errors: {
    generic: "কিছু একটা সমস্যা হয়েছে। আবার চেষ্টা করুন।",
    network: "নেটওয়ার্ক ত্রুটি। আপনার সংযোগ পরীক্ষা করুন।",
    unauthorized: "এই কাজটি করতে আপনাকে লগ ইন করতে হবে।",
  },
  nav: {
    openMenu: "মূল মেনু খুলুন",
    toolkit: "টুলকিট",
  },
  userMenu: {
    accountSettings: "অ্যাকাউন্ট সেটিংস",
    adminDashboard: "অ্যাডমিন ড্যাশবোর্ড",
  },
  account: {
    title: "অ্যাকাউন্ট তথ্য",
    email: "ইমেইল ঠিকানা",
    username: "ইউজারনেম",
    yourPlan: "আপনার প্ল্যান",
    credits: "ক্রেডিট",
    credits_one: "{{count}} ক্রেডিট",
    credits_other: "{{count}} ক্রেডিট",
    about: "সম্পর্কে",
    aboutValue: "আমি একজন চমৎকার গ্রাহক।",
    appAccess: "আপনার অ্যাপ অ্যাক্সেস",
    none: "নেই",
    freePlan: "ফ্রি প্ল্যান",
  },
} as const;

export default bn;
