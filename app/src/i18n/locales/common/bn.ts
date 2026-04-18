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
    verifyEmailOk: "যদি সবকিছু ঠিক থাকে,",
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
  apps: {
    onlineJudge: "অনলাইন জাজ",
    sokafilm: "সোকাফিল্ম",
    redditBot: "রেডিট বট",
    carely: "কেয়ারলি",
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
    subscription: {
      pastDue:
        "আপনার {{plan}} প্ল্যানের পেমেন্ট বকেয়া! অনুগ্রহ করে আপনার সাবস্ক্রিপশন পেমেন্ট তথ্য আপডেট করুন।",
      cancelAtPeriodEnd:
        "আপনার {{plan}} প্ল্যান সাবস্ক্রিপশন বাতিল করা হয়েছে, তবে বর্তমান বিলিং পিরিয়ডের শেষ পর্যন্ত সক্রিয় থাকবে: {{endDate}}",
      deleted:
        "আপনার পূর্ববর্তী সাবস্ক্রিপশন বাতিল করা হয়েছে এবং আর সক্রিয় নেই।",
    },
  },
  notFound: {
    heading: "৪০৪",
    description: "ওহ! আপনি যে পৃষ্ঠাটি খুঁজছেন সেটি নেই।",
    goBackHome: "হোমে ফিরে যান",
  },
  cookieConsent: {
    title: "আমরা কুকি ব্যবহার করি",
    description:
      "আপনার অভিজ্ঞতা উন্নত করতে আমরা মূলত অ্যানালিটিক্সের জন্য কুকি ব্যবহার করি। গ্রহণ করে, আপনি এই কুকির ব্যবহারে সম্মত হচ্ছেন। আপনি আপনার পছন্দ পরিচালনা করতে পারেন বা আমাদের কুকি নীতি সম্পর্কে আরও জানতে পারেন।",
    acceptAll: "সব গ্রহণ করুন",
    rejectAll: "সব প্রত্যাখ্যান",
    privacyPolicy: "গোপনীয়তা নীতি",
    termsAndConditions: "শর্তাবলী"
  },
} as const;

export default bn;
