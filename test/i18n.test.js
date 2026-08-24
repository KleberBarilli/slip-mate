const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const i18n = require("../i18n.js");

const root = path.resolve(__dirname, "..");
const ptBr = JSON.parse(
  fs.readFileSync(path.join(root, "_locales", "pt_BR", "messages.json"), "utf8")
);
const english = JSON.parse(
  fs.readFileSync(path.join(root, "_locales", "en", "messages.json"), "utf8")
);

test("keeps PT-BR and English locale keys in sync", () => {
  assert.deepEqual(Object.keys(english).sort(), Object.keys(ptBr).sort());

  for (const [key, entry] of Object.entries(ptBr)) {
    assert.equal(typeof entry.message, "string", `${key} needs a PT-BR message`);
    assert.ok(entry.message.length > 0, `${key} has an empty PT-BR message`);
    assert.ok(english[key].message.length > 0, `${key} has an empty English message`);
  }
});

test("uses browser messages with a safe bundled fallback", () => {
  const translated = i18n.createI18n({
    getMessage(key) {
      return key === "noLoginSlip" ? "No-login bet slip" : "";
    }
  });

  assert.equal(translated.getMessage("noLoginSlip", undefined, "Bilhete sem login"), "No-login bet slip");
  assert.equal(translated.getMessage("missing", undefined, "Texto padrão"), "Texto padrão");
});

test("configures Chrome localization and references known popup messages", () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(root, "manifest.json"), "utf8"));
  const popup = fs.readFileSync(path.join(root, "popup.html"), "utf8");
  const popupKeys = [...popup.matchAll(/data-i18n="([^"]+)"/g)].map((match) => match[1]);

  assert.equal(manifest.default_locale, "pt_BR");
  assert.equal(manifest.version, "3.2.1");
  assert.equal(manifest.name, "__MSG_extensionName__");
  assert.equal(manifest.description, "__MSG_extensionDescription__");
  assert.ok(manifest.content_scripts[1].js.includes("i18n.js"));
  assert.equal(popupKeys.every((key) => ptBr[key] && english[key]), true);
});
