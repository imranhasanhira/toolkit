import { useTranslation } from "react-i18next";
import { Label } from "../client/components/ui/label";
import { cn } from "../client/utils";
import { SUPPORTED_LANGUAGES, type SupportedLanguage } from ".";

/**
 * Two-state toggle (EN ↔ BN) shaped after DarkModeSwitcher so it fits the
 * existing nav vocabulary without introducing a new component pattern.
 */
const LanguageSwitcher = () => {
  const { i18n } = useTranslation();
  const currentLang = (i18n.resolvedLanguage ||
    i18n.language ||
    "en") as SupportedLanguage;
  const isEnglish = currentLang === "en";
  const nextLang: SupportedLanguage = isEnglish ? "bn" : "en";

  const onToggle = () => {
    if (!SUPPORTED_LANGUAGES.includes(nextLang)) return;
    void i18n.changeLanguage(nextLang);
  };

  return (
    <div>
      <Label
        className={cn(
          "h-7.5 bg-muted relative m-0 block w-14 cursor-pointer rounded-full transition-colors duration-300 ease-in-out",
        )}
        aria-label={`Switch language to ${isEnglish ? "Bengali" : "English"}`}
      >
        <input
          type="checkbox"
          checked={!isEnglish}
          onChange={onToggle}
          className="absolute top-0 z-50 m-0 h-full w-full cursor-pointer opacity-0"
        />
        <span
          className={cn(
            "border-border absolute left-[3px] top-1/2 flex h-6 w-6 -translate-y-1/2 translate-x-0 items-center justify-center rounded-full border bg-white shadow-md transition-all duration-300 ease-in-out",
            {
              "!right-[3px] !translate-x-full": !isEnglish,
            },
          )}
        >
          <LangGlyph lang={currentLang} />
        </span>
      </Label>
    </div>
  );
};

function LangGlyph({ lang }: { lang: SupportedLanguage }) {
  return (
    <span className="text-[0.6rem] font-semibold leading-none text-slate-700">
      {lang === "bn" ? "বাং" : "EN"}
    </span>
  );
}

export default LanguageSwitcher;
