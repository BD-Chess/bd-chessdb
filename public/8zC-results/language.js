const controls = document.querySelector(".languages");
const buttons = controls.querySelectorAll("[data-select-language]");
const titles = {
  sl: "8zC · Rezultati kompresije | MDL×DCC",
  en: "8zC · Compression Results | MDL×DCC",
};

function selectLanguage(language) {
  document.documentElement.lang = language;
  document.documentElement.dataset.language = language;
  document.title = titles[language];
  for (const button of buttons) {
    button.setAttribute("aria-pressed", String(button.dataset.selectLanguage === language));
  }
}

const requested = new URL(location.href).searchParams.get("lang");
selectLanguage(requested === "en" ? "en" : "sl");
for (const button of buttons) {
  button.addEventListener("click", () => {
    const language = button.dataset.selectLanguage;
    selectLanguage(language);
    if (location.protocol === "file:") return;

    const url = new URL(location.href);
    url.searchParams.set("lang", language);
    history.replaceState(null, "", url);
  });
}
controls.hidden = false;
