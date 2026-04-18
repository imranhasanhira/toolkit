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
} as const;

export default bn;
