require("dotenv").config();
const express = require("express");
const path = require("path");

const app = express();
const port = process.env.PORT || 3000;
const publicDirectory = path.join(__dirname, "public");

function getSupabasePublicConfig() {
  return {
    url: process.env.SUPABASE_URL || "",
    anonKey: process.env.SUPABASE_ANON_KEY || "",
    storageBucket: process.env.SUPABASE_STORAGE_BUCKET || "media-assets",
    appUrl: process.env.APP_URL || `http://localhost:${port}`
  };
}

app.get("/api/supabase-config", (req, res) => {
  const config = getSupabasePublicConfig();

  if (!config.url || !config.anonKey) {
    res.status(500).json({
      error: "Configuracao publica do Supabase incompleta. Defina SUPABASE_URL e SUPABASE_ANON_KEY no .env."
    });
    return;
  }

  res.json({
    ...config,
    passwordResetRedirectTo: `${config.appUrl}/login.html?mode=reset`,
    emailRedirectTo: `${config.appUrl}/login.html`
  });
});

app.use(express.static(publicDirectory));

app.get("/", (req, res) => {
  res.sendFile(path.join(publicDirectory, "index.html"));
});

app.listen(port, () => {
  const config = getSupabasePublicConfig();
  console.log(`Servidor rodando em http://localhost:${port}`);

  if (!config.url || !config.anonKey) {
    console.warn("Defina SUPABASE_URL e SUPABASE_ANON_KEY no arquivo .env para habilitar a integracao.");
  }
});
