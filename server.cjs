var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// server.ts
var import_express = __toESM(require("express"), 1);
var import_path = __toESM(require("path"), 1);
var import_fs = __toESM(require("fs"), 1);
var import_vite = require("vite");
var import_genai = require("@google/genai");
process.env.TZ = "America/Sao_Paulo";
var PORT = 3e3;
var DB_FILE = import_path.default.join(process.cwd(), "database.json");
var currentDb = {
  users: [],
  drivers: [],
  vehicles: [],
  products: [],
  activeAssets: [],
  audits: [],
  returnForecasts: [],
  fiscalAlerts: [],
  importedRoutes: [],
  vales: [],
  photos: [],
  customManual: "",
  empilhadores: [],
  carregamentoProcesses: [],
  controleSobras: [],
  fiveSEntries: [],
  safetyReports: [],
  blitzEntries: [],
  zeroBreakDeclarations: []
};
function loadDatabaseFromFile() {
  try {
    if (import_fs.default.existsSync(DB_FILE)) {
      const raw = import_fs.default.readFileSync(DB_FILE, "utf-8").trim();
      if (raw) {
        const parsed = JSON.parse(raw);
        currentDb = { ...currentDb, ...parsed };
        if (!currentDb.photos) currentDb.photos = [];
        console.log(`[Database] Loaded database from ${DB_FILE}`);
      } else {
        saveDatabaseToFile();
      }
    } else {
      saveDatabaseToFile();
    }
  } catch (err) {
    console.error("[Database] Failed to read database.json, reinitializing with default state:", err);
    saveDatabaseToFile();
  }
}
function saveDatabaseToFile() {
  try {
    import_fs.default.writeFileSync(DB_FILE, JSON.stringify(currentDb, null, 2), "utf-8");
  } catch (err) {
    console.error("[Database] Failed to write database.json:", err);
  }
}
loadDatabaseFromFile();
var sseClients = /* @__PURE__ */ new Set();
function broadcastSSEUpdate(data) {
  const payload = `data: ${JSON.stringify(data)}

`;
  for (const res of sseClients) {
    try {
      res.write(payload);
    } catch (e) {
      sseClients.delete(res);
    }
  }
}
async function startServer() {
  const app = (0, import_express.default)();
  app.use(import_express.default.json({ limit: "50mb" }));
  app.use(import_express.default.urlencoded({ extended: true, limit: "50mb" }));
  app.use((req, res, next) => {
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", "0");
    res.setHeader("Surrogate-Control", "no-store");
    next();
  });
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", timestamp: (/* @__PURE__ */ new Date()).toISOString() });
  });
  app.get("/api/db", (req, res) => {
    res.json({ success: true, db: currentDb });
  });
  app.get("/api/export-database", (req, res) => {
    try {
      if (import_fs.default.existsSync(DB_FILE)) {
        res.setHeader("Content-Type", "application/json");
        res.setHeader("Content-Disposition", 'attachment; filename="backup_completo_plataforma.json"');
        const fileStream = import_fs.default.createReadStream(DB_FILE);
        return fileStream.pipe(res);
      } else {
        return res.status(404).json({ success: false, error: "Arquivo database.json ainda n\xE3o foi gerado." });
      }
    } catch (err) {
      return res.status(500).json({ success: false, error: err?.message || "Erro ao exportar banco" });
    }
  });
  const FIREBASE_CONFIG_FILE = import_path.default.join(process.cwd(), "firebase-applet-config.json");
  const SCHEDULE_RULES_FILE = import_path.default.join(process.cwd(), "schedule-rules.json");
  const AUTO_SCHEDULE_FILE = import_path.default.join(process.cwd(), "auto-schedule-setting.json");
  let serverFirebaseConfig = {};
  try {
    if (import_fs.default.existsSync(FIREBASE_CONFIG_FILE)) {
      serverFirebaseConfig = JSON.parse(import_fs.default.readFileSync(FIREBASE_CONFIG_FILE, "utf-8"));
    }
  } catch (e) {
  }
  if (!serverFirebaseConfig.projectId) {
    serverFirebaseConfig.projectId = "retorno-de-rota-pau-brasil";
    serverFirebaseConfig.appId = "1:792483558739:web:1bcaba10d2038d7a6ddda6";
    serverFirebaseConfig.apiKey = "AIzaSyC8Xkvh4Nj-VjzzDwqSNjefu3a79Y6ti2A";
    serverFirebaseConfig.authDomain = "retorno-de-rota-pau-brasil.firebaseapp.com";
    serverFirebaseConfig.storageBucket = "retorno-de-rota-pau-brasil.firebasestorage.app";
    serverFirebaseConfig.firestoreDatabaseId = "default";
    serverFirebaseConfig.messagingSenderId = "792483558739";
    serverFirebaseConfig.measurementId = "G-FTGZF84NKM";
  }
  const SERVER_FIREBASE_PRESETS = [
    {
      id: "banco-oficial",
      name: "Banco de Dados Oficial (Google Cloud Firestore)",
      config: {
        projectId: serverFirebaseConfig.projectId || "retorno-de-rota-pau-brasil",
        appId: serverFirebaseConfig.appId || "1:792483558739:web:1bcaba10d2038d7a6ddda6",
        apiKey: serverFirebaseConfig.apiKey || "AIzaSyC8Xkvh4Nj-VjzzDwqSNjefu3a79Y6ti2A",
        authDomain: serverFirebaseConfig.authDomain || "retorno-de-rota-pau-brasil.firebaseapp.com",
        firestoreDatabaseId: serverFirebaseConfig.firestoreDatabaseId || "default",
        storageBucket: serverFirebaseConfig.storageBucket || "retorno-de-rota-pau-brasil.firebasestorage.app",
        messagingSenderId: serverFirebaseConfig.messagingSenderId || "792483558739",
        measurementId: serverFirebaseConfig.measurementId || "G-FTGZF84NKM",
        oAuthClientId: serverFirebaseConfig.oAuthClientId || ""
      }
    }
  ];
  let pendingDbSwitch = null;
  let customScheduleRules = null;
  let isAutoScheduleServerEnabled = false;
  try {
    if (import_fs.default.existsSync(SCHEDULE_RULES_FILE)) {
      const raw = import_fs.default.readFileSync(SCHEDULE_RULES_FILE, "utf-8");
      customScheduleRules = JSON.parse(raw);
    }
  } catch (e) {
    console.warn("[Firebase] Failed to load schedule-rules.json:", e);
  }
  try {
    if (import_fs.default.existsSync(AUTO_SCHEDULE_FILE)) {
      const raw = import_fs.default.readFileSync(AUTO_SCHEDULE_FILE, "utf-8");
      const parsed = JSON.parse(raw);
      if (typeof parsed.enabled === "boolean") {
        isAutoScheduleServerEnabled = parsed.enabled;
      }
    }
  } catch (e) {
  }
  function getServerScheduledPreset() {
    const rules = Array.isArray(customScheduleRules) && customScheduleRules.length > 0 ? customScheduleRules : [
      { id: "banco_oficial_fixo", name: "Banco Oficial (Todos os Usu\xE1rios)", triggerHour: 0, triggerMinute: 0, presetId: SERVER_FIREBASE_PRESETS[0].id }
    ];
    const now = /* @__PURE__ */ new Date();
    let currentHours = now.getHours();
    let currentMins = now.getMinutes();
    try {
      const formatter = new Intl.DateTimeFormat("pt-BR", {
        timeZone: "America/Sao_Paulo",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false
      });
      const parts = formatter.formatToParts(now);
      for (const p of parts) {
        if (p.type === "hour") currentHours = parseInt(p.value, 10);
        if (p.type === "minute") currentMins = parseInt(p.value, 10);
      }
    } catch (e) {
    }
    const currentMinutes = currentHours * 60 + currentMins;
    const ruleMinutes = rules.map((r) => ({
      presetId: r.presetId,
      mins: (r.triggerHour || 0) * 60 + (r.triggerMinute || 0)
    })).sort((a, b) => a.mins - b.mins);
    if (ruleMinutes.length === 0) return SERVER_FIREBASE_PRESETS[0];
    let activePresetId = ruleMinutes[ruleMinutes.length - 1].presetId;
    for (let i = 0; i < ruleMinutes.length; i++) {
      if (currentMinutes >= ruleMinutes[i].mins) {
        activePresetId = ruleMinutes[i].presetId;
      } else {
        break;
      }
    }
    const found = SERVER_FIREBASE_PRESETS.find((p) => p.id === activePresetId || p.config.projectId === activePresetId);
    return found || SERVER_FIREBASE_PRESETS[0];
  }
  try {
    if (!import_fs.default.existsSync(FIREBASE_CONFIG_FILE) || !serverFirebaseConfig.projectId) {
      const officialConfig = SERVER_FIREBASE_PRESETS[0].config;
      import_fs.default.writeFileSync(FIREBASE_CONFIG_FILE, JSON.stringify(officialConfig, null, 2), "utf-8");
      console.log("[ServerDB] Configura\xE7\xE3o inicial do Firebase gravada em firebase-applet-config.json");
    }
  } catch (e) {
    console.error("[ServerDB] Erro ao sincronizar firebase-applet-config.json:", e);
  }
  setInterval(() => {
    if (pendingDbSwitch && pendingDbSwitch.switchAtTimestamp) {
      if (Date.now() >= pendingDbSwitch.switchAtTimestamp) {
        console.log(`[ServerDB] Timer de troca expirou. Alternando banco no servidor para: ${pendingDbSwitch.targetName || "Novo Banco"}`);
        if (pendingDbSwitch.targetConfig) {
          try {
            import_fs.default.writeFileSync(FIREBASE_CONFIG_FILE, JSON.stringify(pendingDbSwitch.targetConfig, null, 2), "utf-8");
            const newConfig = pendingDbSwitch.targetConfig;
            if (pendingDbSwitch.requestedType === "manual") {
              isAutoScheduleServerEnabled = false;
              try {
                import_fs.default.writeFileSync(AUTO_SCHEDULE_FILE, JSON.stringify({ enabled: false }), "utf-8");
              } catch (e) {
              }
            }
            pendingDbSwitch = null;
            broadcastSSEUpdate({ pendingDbSwitch: null, autoScheduleEnabled: isAutoScheduleServerEnabled, config: newConfig });
          } catch (err) {
            console.error("[ServerDB] Erro ao gravar novo banco no disco:", err);
          }
        } else {
          pendingDbSwitch = null;
          broadcastSSEUpdate({ pendingDbSwitch: null, autoScheduleEnabled: isAutoScheduleServerEnabled });
        }
      }
      return;
    }
    if (isAutoScheduleServerEnabled && !pendingDbSwitch) {
      const scheduledPreset = getServerScheduledPreset();
      let currentProjectId = "";
      if (import_fs.default.existsSync(FIREBASE_CONFIG_FILE)) {
        try {
          const raw = import_fs.default.readFileSync(FIREBASE_CONFIG_FILE, "utf-8");
          const parsed = JSON.parse(raw);
          currentProjectId = parsed.projectId || "";
        } catch (e) {
        }
      }
      if (currentProjectId !== scheduledPreset.config.projectId) {
        console.log(`[ServerDB] Mudan\xE7a de turno programada detectada (${currentProjectId || "Nenhum"} \u2794 ${scheduledPreset.config.projectId}). Alternando banco no servidor...`);
        try {
          import_fs.default.writeFileSync(FIREBASE_CONFIG_FILE, JSON.stringify(scheduledPreset.config, null, 2), "utf-8");
          broadcastSSEUpdate({ pendingDbSwitch: null, autoScheduleEnabled: true, config: scheduledPreset.config });
        } catch (e) {
          console.error("[ServerDB] Erro ao corrigir banco agendado:", e);
        }
      }
    }
  }, 2e3);
  app.get("/api/firebase/auto-schedule", (req, res) => {
    return res.json({ success: true, enabled: isAutoScheduleServerEnabled });
  });
  app.post("/api/firebase/auto-schedule", (req, res) => {
    try {
      const { enabled } = req.body || {};
      isAutoScheduleServerEnabled = !!enabled;
      try {
        import_fs.default.writeFileSync(AUTO_SCHEDULE_FILE, JSON.stringify({ enabled: isAutoScheduleServerEnabled }), "utf-8");
      } catch (e) {
      }
      if (isAutoScheduleServerEnabled) {
        const scheduledPreset = getServerScheduledPreset();
        try {
          import_fs.default.writeFileSync(FIREBASE_CONFIG_FILE, JSON.stringify(scheduledPreset.config, null, 2), "utf-8");
          broadcastSSEUpdate({ autoScheduleEnabled: true, pendingDbSwitch: null, config: scheduledPreset.config, db: currentDb });
          return res.json({ success: true, enabled: true, config: scheduledPreset.config });
        } catch (e) {
        }
      }
      broadcastSSEUpdate({ autoScheduleEnabled: isAutoScheduleServerEnabled, db: currentDb });
      return res.json({ success: true, enabled: isAutoScheduleServerEnabled });
    } catch (err) {
      return res.status(500).json({ success: false, error: err?.message || "Erro ao alterar agendamento autom\xE1tico" });
    }
  });
  app.get("/api/firebase/schedule-rules", (req, res) => {
    return res.json({ success: true, rules: customScheduleRules });
  });
  app.post("/api/firebase/schedule-rules", (req, res) => {
    try {
      const { rules } = req.body || {};
      customScheduleRules = rules;
      try {
        import_fs.default.writeFileSync(SCHEDULE_RULES_FILE, JSON.stringify(rules, null, 2), "utf-8");
      } catch (e) {
      }
      broadcastSSEUpdate({ scheduleRules: customScheduleRules, db: currentDb });
      return res.json({ success: true, rules: customScheduleRules });
    } catch (err) {
      return res.status(500).json({ success: false, error: err?.message || "Erro ao salvar hor\xE1rios de troca" });
    }
  });
  app.get("/api/firebase/pending-switch", (req, res) => {
    return res.json({ success: true, pendingSwitch: pendingDbSwitch });
  });
  app.post("/api/firebase/trigger-switch", (req, res) => {
    try {
      const { targetPresetId, targetConfig, targetName, countdownSeconds = 60, requestedBy, requestedType = "manual" } = req.body || {};
      const now = Date.now();
      if (requestedType === "manual") {
        isAutoScheduleServerEnabled = false;
        try {
          import_fs.default.writeFileSync(AUTO_SCHEDULE_FILE, JSON.stringify({ enabled: false }), "utf-8");
        } catch (e) {
        }
      }
      pendingDbSwitch = {
        targetPresetId,
        targetConfig,
        targetName,
        switchAtTimestamp: now + countdownSeconds * 1e3,
        startedAt: now,
        requestedBy: requestedBy || "Gestor Administrador",
        requestedType: requestedType || "manual"
      };
      broadcastSSEUpdate({ pendingDbSwitch, autoScheduleEnabled: isAutoScheduleServerEnabled, db: currentDb });
      return res.json({ success: true, pendingSwitch: pendingDbSwitch });
    } catch (err) {
      return res.status(500).json({ success: false, error: err?.message || "Erro ao iniciar troca de banco" });
    }
  });
  app.post("/api/firebase/cancel-switch", (req, res) => {
    pendingDbSwitch = null;
    broadcastSSEUpdate({ pendingDbSwitch: null, db: currentDb });
    return res.json({ success: true, message: "Troca de banco de dados cancelada" });
  });
  app.get("/api/firebase/config", (req, res) => {
    try {
      if (isAutoScheduleServerEnabled) {
        const scheduledPreset = getServerScheduledPreset();
        if (scheduledPreset && scheduledPreset.config) {
          try {
            import_fs.default.writeFileSync(FIREBASE_CONFIG_FILE, JSON.stringify(scheduledPreset.config, null, 2), "utf-8");
          } catch (e) {
          }
          return res.json({ success: true, config: scheduledPreset.config, pendingSwitch: pendingDbSwitch });
        }
      }
      if (import_fs.default.existsSync(FIREBASE_CONFIG_FILE)) {
        const raw = import_fs.default.readFileSync(FIREBASE_CONFIG_FILE, "utf-8");
        const config = JSON.parse(raw);
        return res.json({ success: true, config, pendingSwitch: pendingDbSwitch });
      }
    } catch (err) {
      console.error("[Firebase] Failed to read config file:", err);
    }
    const fallback = getServerScheduledPreset();
    return res.json({ success: true, config: fallback.config, pendingSwitch: pendingDbSwitch });
  });
  app.post("/api/firebase/config", (req, res) => {
    try {
      const config = req.body;
      if (!config || !config.apiKey || !config.projectId) {
        return res.status(400).json({ success: false, error: "API Key e Project ID s\xE3o obrigat\xF3rios" });
      }
      import_fs.default.writeFileSync(FIREBASE_CONFIG_FILE, JSON.stringify(config, null, 2), "utf-8");
      isAutoScheduleServerEnabled = false;
      try {
        import_fs.default.writeFileSync(AUTO_SCHEDULE_FILE, JSON.stringify({ enabled: false }), "utf-8");
      } catch (e) {
      }
      pendingDbSwitch = null;
      broadcastSSEUpdate({ pendingDbSwitch: null, autoScheduleEnabled: false, config });
      return res.json({ success: true, message: "Configura\xE7\xE3o salva com sucesso", config });
    } catch (err) {
      console.error("[Firebase] Failed to save config file:", err);
      return res.status(500).json({ success: false, error: err?.message || "Erro ao salvar configura\xE7\xE3o" });
    }
  });
  app.post("/api/firebase/test", async (req, res) => {
    try {
      const config = req.body;
      if (!config || !config.apiKey || !config.projectId) {
        return res.status(400).json({ success: false, error: "API Key e Project ID s\xE3o obrigat\xF3rios para testar a conex\xE3o." });
      }
      const dbId = config.firestoreDatabaseId || "default";
      const testUrl = `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(config.projectId)}/databases/${encodeURIComponent(dbId)}/documents/system_status/database_info?key=${encodeURIComponent(config.apiKey)}`;
      try {
        const response = await fetch(testUrl);
        if (response.ok) {
          return res.json({
            success: true,
            message: `Conex\xE3o bem sucedida com o Google Cloud Firestore! Projeto: "${config.projectId}", Banco: "${dbId}".`
          });
        }
        if (response.status === 404) {
          const usersTestUrl = `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(config.projectId)}/databases/${encodeURIComponent(dbId)}/documents/users?key=${encodeURIComponent(config.apiKey)}`;
          const usersRes = await fetch(usersTestUrl);
          if (usersRes.ok) {
            return res.json({
              success: true,
              message: `Conex\xE3o bem sucedida com o Google Cloud Firestore! Projeto: "${config.projectId}", Banco: "${dbId}".`
            });
          }
          return res.status(404).json({
            success: false,
            error: `Projeto "${config.projectId}" ou Banco "${dbId}" n\xE3o foi encontrado no Google Cloud. Verifique se o ID do banco \xE9 'default' ou '(default)'.`
          });
        }
        if (response.status === 403) {
          return res.status(403).json({
            success: false,
            error: `Acesso negado (403). Verifique se a API Key \xE9 v\xE1lida ou se as Regras de Seguran\xE7a do Firestore est\xE3o configuradas.`
          });
        }
        const errText = await response.text();
        return res.status(response.status).json({
          success: false,
          error: `Resposta do Google Cloud (${response.status}): ${errText.slice(0, 150)}`
        });
      } catch (fetchErr) {
        return res.status(500).json({ success: false, error: `Erro ao contatar Google Cloud: ${fetchErr?.message}` });
      }
    } catch (err) {
      return res.status(500).json({ success: false, error: err?.message || "Erro no teste de conex\xE3o." });
    }
  });
  app.post("/api/firebase/clear", (req, res) => {
    try {
      const emptyConfig = {
        projectId: "",
        appId: "",
        apiKey: "",
        authDomain: "",
        firestoreDatabaseId: "(default)",
        storageBucket: "",
        messagingSenderId: "",
        measurementId: "",
        oAuthClientId: ""
      };
      import_fs.default.writeFileSync(FIREBASE_CONFIG_FILE, JSON.stringify(emptyConfig, null, 2), "utf-8");
      return res.json({ success: true, message: "Configura\xE7\xF5es do Firebase zeradas com sucesso." });
    } catch (err) {
      return res.status(500).json({ success: false, error: err?.message || "Erro ao limpar configura\xE7\xF5es." });
    }
  });
  app.post("/api/db", (req, res) => {
    const { db } = req.body || {};
    if (db && typeof db === "object") {
      currentDb = {
        ...currentDb,
        ...db
      };
      saveDatabaseToFile();
      broadcastSSEUpdate({ db: currentDb });
      res.json({ success: true, db: currentDb });
    } else {
      res.status(400).json({ success: false, error: "Invalid db payload" });
    }
  });
  app.get("/api/db/events", (req, res) => {
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders();
    sseClients.add(res);
    res.write(`data: ${JSON.stringify({ db: currentDb })}

`);
    const heartbeat = setInterval(() => {
      try {
        res.write(": heartbeat\n\n");
      } catch (e) {
        clearInterval(heartbeat);
        sseClients.delete(res);
      }
    }, 15e3);
    req.on("close", () => {
      clearInterval(heartbeat);
      sseClients.delete(res);
    });
  });
  app.post("/api/concluir-baixa", (req, res) => {
    try {
      const { auditId, pdfBase64, filename, updatedAuditSession, updatedImportedRoutes, updatedAlerts } = req.body || {};
      if (updatedAuditSession) {
        if (!currentDb.audits) currentDb.audits = [];
        const idx = currentDb.audits.findIndex((a) => a.id === auditId);
        if (idx >= 0) {
          currentDb.audits[idx] = updatedAuditSession;
        } else {
          currentDb.audits.push(updatedAuditSession);
        }
      }
      if (Array.isArray(updatedImportedRoutes)) {
        currentDb.importedRoutes = updatedImportedRoutes;
      }
      if (Array.isArray(updatedAlerts)) {
        currentDb.fiscalAlerts = updatedAlerts;
      }
      saveDatabaseToFile();
      broadcastSSEUpdate({ db: currentDb });
      return res.json({
        success: true,
        message: "Baixa processada com sucesso no servidor.",
        auditId,
        filename,
        durableBackup: { cloudStorage: false, firestore: true }
      });
    } catch (err) {
      console.error("[Server] Erro em /api/concluir-baixa:", err);
      return res.status(500).json({
        success: false,
        error: err?.message || "Erro ao processar baixa no servidor"
      });
    }
  });
  app.get("/api/photos", (req, res) => {
    const { auditId } = req.query;
    let photos = currentDb.photos || [];
    if (auditId && typeof auditId === "string") {
      photos = photos.filter((p) => p.auditId === auditId);
    }
    res.json({ success: true, photos });
  });
  app.post("/api/photos", (req, res) => {
    const { photo } = req.body || {};
    if (!photo || !photo.id) {
      return res.status(400).json({ success: false, error: "Invalid photo payload" });
    }
    if (!currentDb.photos) currentDb.photos = [];
    const index = currentDb.photos.findIndex((p) => p.id === photo.id);
    const syncedPhoto = { ...photo, syncPending: false };
    if (index >= 0) {
      currentDb.photos[index] = syncedPhoto;
    } else {
      currentDb.photos.push(syncedPhoto);
    }
    saveDatabaseToFile();
    broadcastSSEUpdate({ db: currentDb });
    res.json({ success: true, photo: syncedPhoto });
  });
  app.delete("/api/photos/:id", (req, res) => {
    const { id } = req.params;
    if (currentDb.photos) {
      currentDb.photos = currentDb.photos.filter((p) => p.id !== id);
      saveDatabaseToFile();
      broadcastSSEUpdate({ db: currentDb });
    }
    res.json({ success: true });
  });
  app.post("/api/photos/clear", (req, res) => {
    currentDb.photos = [];
    saveDatabaseToFile();
    broadcastSSEUpdate({ db: currentDb });
    res.json({ success: true });
  });
  app.post("/api/photos/prune", (req, res) => {
    const { daysRetention } = req.body || {};
    const retention = typeof daysRetention === "number" ? daysRetention : 30;
    const cutoff = Date.now() - retention * 24 * 60 * 60 * 1e3;
    const initialCount = (currentDb.photos || []).length;
    currentDb.photos = (currentDb.photos || []).filter((p) => {
      const pTime = new Date(p.timestamp || 0).getTime();
      return pTime >= cutoff;
    });
    const prunedCount = initialCount - currentDb.photos.length;
    saveDatabaseToFile();
    broadcastSSEUpdate({ db: currentDb });
    res.json({ success: true, prunedCount });
  });
  app.post("/api/chat", async (req, res) => {
    const { message, history } = req.body || {};
    if (!message) {
      return res.status(400).json({ error: "Mensagem em branco" });
    }
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({
        error: "Chave GEMINI_API_KEY n\xE3o configurada no servidor."
      });
    }
    try {
      const ai = new import_genai.GoogleGenAI({ apiKey });
      const routes = currentDb.importedRoutes || [];
      const audits = currentDb.audits || [];
      const vales = currentDb.vales || [];
      const drivers = currentDb.drivers || [];
      const openRoutes = routes.filter((r) => r.status !== "fechado");
      const closedRoutes = routes.filter((r) => r.status === "fechado");
      const systemInstruction = `Voc\xEA \xE9 o Assistente Virtual Inteligente da plataforma "Aferi\xE7\xE3o de Retorno de Rota - Pau Brasil Distribuidora Ambev".
Seu papel \xE9 tirar d\xFAvidas dos usu\xE1rios de forma prestativa, direta, simples e profissional, dando respostas EXTREMAMENTE ASSERTIVAS baseadas nos dados ativos da unidade.

DADOS ATIVOS DA UNIDADE:
- Rotas Importadas: ${routes.length} (Abertas: ${openRoutes.length}, Fechadas: ${closedRoutes.length})
- Rotas Abertas: ${openRoutes.map((r) => `Mapa ${r.routeMap} (Placa ${r.plate})`).join(", ") || "Nenhuma"}
- Auditorias com Diverg\xEAncia Registradas: ${audits.filter((a) => a.status === "finalizado_divergente").length}
- Vales Registrados: ${vales.length}
`;
      const contents = [
        ...Array.isArray(history) ? history.map((h) => ({
          role: h.role === "user" ? "user" : "model",
          parts: [{ text: h.text || "" }]
        })) : [],
        {
          role: "user",
          parts: [{ text: message }]
        }
      ];
      let modelResponse;
      try {
        modelResponse = await ai.models.generateContent({
          model: "gemini-2.5-flash",
          contents,
          config: { systemInstruction }
        });
      } catch (err) {
        modelResponse = await ai.models.generateContent({
          model: "gemini-1.5-flash",
          contents,
          config: { systemInstruction }
        });
      }
      res.json({ text: modelResponse.text || "Sem resposta." });
    } catch (err) {
      console.error("[Gemini API Error]", err);
      res.status(500).json({ error: err?.message || "Erro ao comunicar com a intelig\xEAncia artificial" });
    }
  });
  if (process.env.NODE_ENV !== "production") {
    const vite = await (0, import_vite.createServer)({
      server: { middlewareMode: true },
      appType: "spa"
    });
    app.use(vite.middlewares);
  } else {
    const distPath = import_path.default.join(process.cwd(), "dist");
    app.use(import_express.default.static(distPath, {
      etag: false,
      lastModified: false,
      setHeaders: (res) => {
        res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
        res.setHeader("Pragma", "no-cache");
        res.setHeader("Expires", "0");
      }
    }));
    app.get("*", (req, res) => {
      res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
      res.setHeader("Pragma", "no-cache");
      res.setHeader("Expires", "0");
      res.sendFile(import_path.default.join(distPath, "index.html"));
    });
  }
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[LogiRoute] Server running on http://0.0.0.0:${PORT}`);
  });
}
startServer().catch((err) => {
  console.error("[Server Start Error]", err);
  process.exit(1);
});
//# sourceMappingURL=server.cjs.map
