const { Telegraf } = require('telegraf');

// REDIS
let redis = null;
try {
  const Redis = require('ioredis');
  if (process.env.REDIS_URL) {
    redis = new Redis(process.env.REDIS_URL);
    redis.on("connect", () => console.log("Redis conectado"));
    redis.on("error", (e) => console.log("Erro no Redis:", e.message));
  }
} catch (e) {
  console.log("Redis não carregado:", e.message);
}

const bot = new Telegraf(process.env.BOT_TOKEN);

const c = "<tg-emoji emoji-id='4916220696025106096'>💀</tg-emoji>";
const whitelist = ["dimensao-fantasma.pages.dev"];

const isAdmin = async (ctx) => {
  try {
    const m = await ctx.telegram.getChatMember(ctx.chat.id, ctx.from.id);
    return ["creator", "administrator"].includes(m.status);
  } catch { return false; }
};

const formatUser = (u) => {
  if (u.isIdOnly) {
    return `ID: <code>${u.id}</code>`;
  }

  const nome = u.first_name || "Sem nome";
  const user = u.username ? ` (@${u.username})` : "";
  return `${nome}${user}\nID: <code>${u.id}</code>`;
};

const getMotivo = (t, cmd) => {
  let r = t.replace(cmd, "").trim();
  return r ? r : "decisão da administração";
};

const sendLog = async (ctx, chatId, acao, alvo, admin, motivo) => {
  if (!redis) return;
  const logChannel = await redis.get(`log_channel:${chatId}`);
  if (!logChannel) return;
  const logMsg = `${c} <b>REGISTRO DO CEIFADOR</b>\n\n⚖️ Ação: ${acao}\n\n👤 Alma:\n${alvo}\n\n🛡️ Ceifador:\n${admin}\n\n📄 Motivo:\n${motivo}\n\n📍 Território:\n<code>${chatId}</code>`;
  await ctx.telegram.sendMessage(logChannel, logMsg, { parse_mode: 'HTML' }).catch(() => {});
};

// --- FUNÇÃO AUXILIAR: LOCALIZADOR DE ALMAS (FINAL ESTÁVEL) ---
const getTarget = async (ctx) => {
  if (!ctx.message) return null;

  // --- PRIORIDADE 1: REPLY ---
  if (ctx.message.reply_to_message) {
    return ctx.message.reply_to_message.from;
  }

  const text = ctx.message.text || ctx.message.caption || "";
  const args = text.trim().split(/\s+/);

  if (args.length > 1) {
    const alvo = args[1];

    // --- PRIORIDADE 2: ID DIRETO ---
    if (/^\d+$/.test(alvo)) {
      return { id: Number(alvo), first_name: "Usuário", isIdOnly: true };
    }

    // --- PRIORIDADE 3: USERNAME ---
    if (alvo.startsWith("@")) {
      const username = alvo.slice(1).toLowerCase();

      if (redis) {
        const userId = await redis.get(`user:username:${username}`);
        if (userId) {
          return { id: Number(userId), first_name: "@" + username };
        }
      }

      // --- NÃO ENCONTRADO NO CACHE ---
      await ctx.reply(
        `${c} <b>Alma não encontrada no registro.</b>\n\nPeça para o usuário enviar uma mensagem no grupo primeiro.\n\nDepois retorne… o Ceifador aguardará.`,
        { parse_mode: "HTML" }
      );

      return null;
    }
  }

  // --- NENHUM ALVO IDENTIFICADO ---
  return null;
};

// --- [1] START: O PACTO SELADO ---
bot.command("start", async (ctx) => {
  if (ctx.chat.type !== "private") return;
  const mention = `<a href="tg://user?id=${ctx.from.id}"><b>${ctx.from.first_name}</b></a>`;

  await ctx.reply(`${c} <b>SAUDAÇÕES! O PACTO ESTÁ SELADO, ${mention}!</b>\n\n<i>Gerencie os poderes do território através dos módulos abaixo:</i>`, {
    parse_mode: 'HTML',
    reply_markup: {
      inline_keyboard: [
        [{ text: "📜 Logs", callback_data: "menu_logs" }, { text: "⚠️ Advertências", callback_data: "menu_warn" }],
        [{ text: "🛡️ Moderação", callback_data: "menu_mod" }, { text: "⚙️ Sistema", callback_data: "menu_sys" }],
        [{ text: "🧛 Agente IA Enterprise", callback_data: "menu_ai" }]
      ]
    }
  });
});

// CALLBACKS
bot.on("callback_query", async (ctx) => {
  const data = ctx.callbackQuery.data;
  if (!data) return;

  try {
    // --- BLOCO 1: SUCESSO E CÓPIA ---
    if (data === "del_msg") { await ctx.deleteMessage().catch(() => {}); return ctx.answerCbQuery("🗑️"); }
    if (data.startsWith("copy_")) {
      const txt = Buffer.from(data.replace("copy_", ""), 'base64').toString();
      await ctx.reply(`<code>${txt}</code>`, { parse_mode: 'HTML' });
      return ctx.answerCbQuery("✅ Copiado!");
    }
    if (data.startsWith("alert_")) {
      const alertMsg = await redis.get(`alert_msg:${data}`) || "💀";
      return ctx.answerCbQuery(alertMsg, { show_alert: data.includes("_PP_") });
    }

    // --- BLOCO 2: MENU LIMPEZA ---
    if (data === "menu_limpeza") {
      await ctx.editMessageText(`🧹 <b>SISTEMA DE LIMPEZA</b>`, { parse_mode: 'HTML', reply_markup: { inline_keyboard: [[{ text: "🤖 Limpar Admins", callback_data: "limpeza_admin" }], [{ text: "👥 Limpar Users", callback_data: "limpeza_user" }], [{ text: "⬅️ Voltar", callback_data: "back_start" }]] } });
      return ctx.answerCbQuery();
    }
    if (data === "limpeza_admin" || data === "limpeza_user") {
      const startId = ctx.callbackQuery.message.message_id;
      for (let i = 0; i < 50; i++) { await ctx.telegram.deleteMessage(ctx.chat.id, startId - i).catch(() => {}); }
      return ctx.answerCbQuery("🧹 Purificado!", { show_alert: true });
    }

    // --- BLOCO 3: O RESTANTE DO SEU CÓDIGO ---
    // AQUI VOCÊ COLA O SEU CÓDIGO ORIGINAL (REPORT_JULGAR, MENU_LOGS, ETC...)
    // ... cole aqui do "if (data === "report_julgar")" até o final ...

  } catch (err) {
    console.error("Erro no callback:", err);
    ctx.answerCbQuery("❌ Erro no ritual.").catch(() => {});
  }



  const adm = await redis.get(`clean:admin:${gId}`) || "off";
  const usr = await redis.get(`clean:user:${gId}`) || "off";

  await ctx.editMessageText(`🧹 <b>SISTEMA DE LIMPEZA</b>

Configure quais comandos devem ser apagados automaticamente no território.

🛡️ Admins: ${adm === "on" ? "🟢 Ativo" : "🔴 Desligado"}
👥 Usuários: ${usr === "on" ? "🟢 Ativo" : "🔴 Desligado"}`, {
    parse_mode: "HTML",
    reply_markup: {
      inline_keyboard: [
        [
          { text: "🛡️ Configurar Admins", callback_data: `clean_admin_${gId}` },
          { text: "👥 Configurar Usuários", callback_data: `clean_user_${gId}` }
        ],
        [{ text: "⬅️ Voltar", callback_data: `mod_group_${gId}` }]
      ]
    }
  });
  

  return ctx.answerCbQuery();

// ================================
// SUBMENU ADMIN / USER
// ================================
if (data.startsWith("clean_admin_") || data.startsWith("clean_user_")) {
  const isAdminMenu = data.startsWith("clean_admin_");
  const gId = data.replace(isAdminMenu ? "clean_admin_" : "clean_user_", "");

  const key = isAdminMenu ? `clean:admin:${gId}` : `clean:user:${gId}`;
  const status = await redis.get(key) || "off";

  await ctx.editMessageText(`⚙️ <b>CONFIGURAÇÃO DE COMANDOS</b>

${isAdminMenu ? "🛡️ Admins" : "👥 Usuários"}

Status atual: ${status === "on" ? "🟢 Ativo" : "🔴 Desligado"}

Ative para apagar automaticamente mensagens de comando (/ ! .)`, {
    parse_mode: "HTML",
    reply_markup: {
      inline_keyboard: [
        [
          { text: "🟢 Ativar", callback_data: `clean_on_${isAdminMenu ? "admin" : "user"}_${gId}` },
          { text: "🔴 Desativar", callback_data: `clean_off_${isAdminMenu ? "admin" : "user"}_${gId}` }
        ],
        [{ text: "⬅️ Voltar", callback_data: `cfg_clean_${gId}` }]
      ]
    }
  });

  return ctx.answerCbQuery();
}

// ================================
// ATIVAR / DESATIVAR
// ================================
if (data.startsWith("clean_on_") || data.startsWith("clean_off_")) {
  const parts = data.split("_");
  const action = parts[1]; // on/off
  const type = parts[2];   // admin/user
  const gId = parts[3];

  const key = `clean:${type}:${gId}`;

  await redis.set(key, action === "on" ? "on" : "off");

  await ctx.answerCbQuery("Configuração atualizada");

  return ctx.editMessageReplyMarkup({
    inline_keyboard: [
      [{ text: "🔄 Atualizar", callback_data: `cfg_clean_${gId}` }]
    ]
  });
}

  // --- MOTOR DO BOTÃO DE JULGAMENTO (RESOLVIDO) ---
  if (data === "report_julgar") {
    try {
      const msg = ctx.callbackQuery.message;
      const urlOriginal = msg.reply_markup.inline_keyboard[0][0].url;

      await ctx.editMessageReplyMarkup({
        inline_keyboard: [
          [{ text: "🔗 Ver Mensagem", url: urlOriginal }],
          [{ text: "✅ Resolvido", callback_data: "report_ja_julgado" }]
        ]
      });
      return ctx.answerCbQuery("⚖️ Alma julgada com sucesso!");
    } catch (e) { 
      return ctx.answerCbQuery("❌ Erro ao processar julgamento."); 
    }
  }

  if (data === "report_ja_julgado") {
    return ctx.answerCbQuery("✅ Este chamado já foi atendido.");
  }

  if (data === "menu_logs") {
    if (!redis) return ctx.editMessageText(`${c} <b>Memória indisponível.</b>`, { parse_mode: 'HTML' });
    const grupos = await redis.smembers(`admin_groups:${ctx.from.id}`);
    if (!grupos || grupos.length === 0) {
      return ctx.editMessageText(`${c} <b>Nenhum território vinculado.</b>\n\nUse /setlog em um grupo.`, {
        parse_mode: 'HTML',
        reply_markup: { inline_keyboard: [[{ text: "⬅️ Voltar", callback_data: "back_start" }]] }
      });
    }
    const buttons = [];
    for (const groupId of grupos) {
      try {
        const chatInfo = await ctx.telegram.getChat(groupId);
        const logChannel = await redis.get(`log_channel:${groupId}`);
        const status = logChannel ? "🟢" : "⚠️";
        buttons.push([{ text: `${status} ${chatInfo.title}`, callback_data: `log_group_${groupId}` }]);
      } catch (e) {
        buttons.push([{ text: `❌ ID: ${groupId}`, callback_data: `log_group_${groupId}` }]);
      }
    }
    buttons.push([{ text: "⬅️ Voltar", callback_data: "back_start" }]);
    await ctx.editMessageText(`${c} <b>📜 Sistema de Logs</b>\n\nSelecione um território:`, {
      parse_mode: 'HTML',
      reply_markup: { inline_keyboard: buttons }
    });
  }

// --- [2] VOLTAR PARA O INÍCIO (BACK_START) ---
if (data === "back_start") {
  const mention = `<a href="tg://user?id=${ctx.from.id}"><b>${ctx.from.first_name}</b></a>`;
  await ctx.editMessageText(`${c} <b>SAUDAÇÕES! O PACTO ESTÁ SELADO, ${mention}!</b>\n\n<i>Gerencie os poderes do território através dos módulos abaixo:</i>`, {
    parse_mode: 'HTML',
    reply_markup: {
      inline_keyboard: [
        [{ text: "📜 Logs", callback_data: "menu_logs" }, { text: "⚠️ Advertências", callback_data: "menu_warn" }],
        [{ text: "🛡️ Moderação", callback_data: "menu_mod" }, { text: "⚙️ Sistema", callback_data: "menu_sys" }],
        [{ text: "🧛 Agente IA Enterprise", callback_data: "menu_ai" }]
      ]
    }
  });
}

  if (data.startsWith("log_group_")) {
    const groupId = data.replace("log_group_", "");
    let title = groupId;
    try { const chat = await ctx.telegram.getChat(groupId); title = chat.title; } catch (e) {}
    const logChannel = await redis.get(`log_channel:${groupId}`);
    const status = logChannel ? "📜 Log ativo" : "⚠️ Sem log";
    await ctx.editMessageText(`${c} <b>Configuração de Logs</b>\n\nTerritório: <b>${title}</b>\nID: <code>${groupId}</code>\n\nStatus: ${status}`, {
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [
          [{ text: "❌ Remover log", callback_data: `remove_log_${groupId}` }],
          [{ text: "⬅️ Voltar", callback_data: "menu_logs" }]
        ]
      }
    });
  }

  if (data.startsWith("remove_log_")) {
    const groupId = data.replace("remove_log_", "");
    await redis.del(`log_channel:${groupId}`);
    await ctx.editMessageText(`${c} <b>Pacto quebrado.</b>\n\nEste território não será mais observado.`, {
      parse_mode: 'HTML',
      reply_markup: { inline_keyboard: [[{ text: "⬅️ Voltar", callback_data: "menu_logs" }]] }
    });
  }

  if (data === "menu_warn") {
    if (!redis) return ctx.editMessageText(`${c} <b>Memória indisponível.</b>`, { parse_mode: 'HTML' });
    const grupos = await redis.smembers(`admin_groups:${ctx.from.id}`);
    if (!grupos || grupos.length === 0) {
      return ctx.editMessageText(`${c} <b>Nenhum território vinculado.</b>\n\nUse /setlog em um grupo primeiro.`, {
        parse_mode: 'HTML',
        reply_markup: { inline_keyboard: [[{ text: "⬅️ Voltar", callback_data: "back_start" }]] }
      });
    }
    const buttons = [];
    for (const g of grupos) {
      try {
        const chat = await ctx.telegram.getChat(g);
        const limit = (await redis.get(`warn:limit:${g}`)) || "4";
        const action = (await redis.get(`warn:action:${g}`)) || "ban";
        buttons.push([{ text: `⚠️ ${chat.title} — ${limit} | ${action}`, callback_data: `warn_group_${g}` }]);
      } catch (e) {
        buttons.push([{ text: `⚠️ ID: ${g}`, callback_data: `warn_group_${g}` }]);
      }
    }
    buttons.push([{ text: "⬅️ Voltar", callback_data: "back_start" }]);
    await ctx.editMessageText(`${c} <b>⚠️ Sistema de Advertência</b>\n\nSelecione um território:`, {
      parse_mode: 'HTML',
      reply_markup: { inline_keyboard: buttons }
    });
  }

  if (data.startsWith("warn_group_")) {
    const groupId = data.replace("warn_group_", "");
    let title = groupId;
    try { const chat = await ctx.telegram.getChat(groupId); title = chat.title; } catch (e) {}
    const limit = (await redis.get(`warn:limit:${groupId}`)) || "4";
    const action = (await redis.get(`warn:action:${groupId}`)) || "ban";
    await ctx.editMessageText(`${c} <b>⚠️ Warn — Território</b>\n\n<b>${title}</b>\n\nLimite: ${limit}\nAção: ${action}`, {
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [
          [{ text: "➕ Limite", callback_data: `wlu_${groupId}` }, { text: "➖ Limite", callback_data: `wld_${groupId}` }],
          [{ text: "⚖️ Alternar ação (ban/mute)", callback_data: `wat_${groupId}` }],
          [{ text: "⬅️ Voltar", callback_data: "menu_warn" }]
        ]
      }
    });
  }

  if (data.startsWith("wlu_")) {
    const groupId = data.replace("wlu_", "");
    let limit = parseInt(await redis.get(`warn:limit:${groupId}`)) || 4;
    limit = Math.min(limit + 1, 10);
    await redis.set(`warn:limit:${groupId}`, limit);
    const action = (await redis.get(`warn:action:${groupId}`)) || "ban";
    await ctx.editMessageText(`${c} <b>⚠️ Warn — Território</b>\n\n<code>${groupId}</code>\n\nLimite: ${limit}\nAção: ${action}`, {
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [
          [{ text: "➕ Limite", callback_data: `wlu_${groupId}` }, { text: "➖ Limite", callback_data: `wld_${groupId}` }],
          [{ text: "⚖️ Alternar ação (ban/mute)", callback_data: `wat_${groupId}` }],
          [{ text: "⬅️ Voltar", callback_data: "menu_warn" }]
        ]
      }
    });
  }

  if (data.startsWith("wld_")) {
    const groupId = data.replace("wld_", "");
    let limit = parseInt(await redis.get(`warn:limit:${groupId}`)) || 4;
    limit = Math.max(limit - 1, 1);
    await redis.set(`warn:limit:${groupId}`, limit);
    const action = (await redis.get(`warn:action:${groupId}`)) || "ban";
    await ctx.editMessageText(`${c} <b>⚠️ Warn — Território</b>\n\n<code>${groupId}</code>\n\nLimite: ${limit}\nAção: ${action}`, {
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [
          [{ text: "➕ Limite", callback_data: `wlu_${groupId}` }, { text: "➖ Limite", callback_data: `wld_${groupId}` }],
          [{ text: "⚖️ Alternar ação (ban/mute)", callback_data: `wat_${groupId}` }],
          [{ text: "⬅️ Voltar", callback_data: "menu_warn" }]
        ]
      }
    });
  }

  if (data.startsWith("wat_")) {
    const groupId = data.replace("wat_", "");
    let action = (await redis.get(`warn:action:${groupId}`)) || "ban";
    action = action === "ban" ? "mute" : "ban";
    await redis.set(`warn:action:${groupId}`, action);
    const limit = (await redis.get(`warn:limit:${groupId}`)) || "4";
    await ctx.editMessageText(`${c} <b>⚠️ Warn — Território</b>\n\n<code>${groupId}</code>\n\nLimite: ${limit}\nAção: ${action}`, {
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [
          [{ text: "➕ Limite", callback_data: `wlu_${groupId}` }, { text: "➖ Limite", callback_data: `wld_${groupId}` }],
          [{ text: "⚖️ Alternar ação (ban/mute)", callback_data: `wat_${groupId}` }],
          [{ text: "⬅️ Voltar", callback_data: "menu_warn" }]
        ]
      }
    });
  }

  // =========================================================
// --- [RITUAL] CONSTRUTOR DINÂMICO DIMENSÃO FANTASMA ---
// =========================================================
if (data.startsWith("w_ritual_")) {
  const gId = data.replace("w_ritual_", "");
  const draft = await redis.hgetall(`w_temp:${ctx.from.id}`) || {};
  
  // Aqui está o segredo: nomes batendo com o que você digita
  const txtStat = draft.text ? "✅ (Definido)" : "❌ (Vazio)";
  const medStat = draft.media ? "✅ (Definida)" : "❌ (Vazia)";
  const btnStat = draft.buttons ? "✅ (Definidos)" : "❌ (Vazio)";
  
  await ctx.editMessageText(`${c} <b>CONSTRUTOR DE RECEPÇÃO</b>\n\n📜 <b>O Verbo:</b> ${txtStat}\n👁️ <b>A Visão:</b> ${medStat}\n⛓️ <b>As Correntes:</b> ${btnStat}\n\n<i>Selecione o que deseja moldar:</i>`, { 
    parse_mode: "HTML", 
    reply_markup: { 
      inline_keyboard: [
        [{ text: "📝 Definir Texto", callback_data: `w_edit_txt_${gId}` }], 
        [{ text: "🖼️ Definir Mídia", callback_data: `w_edit_med_${gId}` }], 
        [{ text: "🔘 Definir Botões", callback_data: `w_edit_btn_${gId}` }], 
        [{ text: "🔥 SELAR PACTO (Salvar)", callback_data: `w_save_ritual_${gId}` }], 
        [{ text: "❌ Interromper", callback_data: `cfg_welcome_${gId}` }]
      ] 
    } 
  });
}

if (data.startsWith("w_edit_")) {
  const [,, type, gId] = data.split("_");
  await redis.set(`w_step:${ctx.from.id}`, `${type}:${gId}`);
  const msgs = { txt: "o <b>TEXTO</b>", med: "a <b>MÍDIA</b> (Foto, Vídeo ou GIF)", btn: "a estrutura dos <b>BOTÕES</b>" };
  await ctx.editMessageText(`${c} Envie agora ${msgs[type]} da recepção.\n\n<i>O Ceifador aguarda seu comando...</i>`, { 
    parse_mode: "HTML", 
    reply_markup: { inline_keyboard: [[{ text: "⬅️ Voltar", callback_data: `w_ritual_${gId}` }]] } 
  });
}

if (data.startsWith("w_save_ritual_")) {
  const gId = data.replace("w_save_ritual_", "");
  const d = await redis.hgetall(`w_temp:${ctx.from.id}`);
  if (!d.text) return ctx.answerCbQuery("⚠️ O Verbo (Texto) é obrigatório!");

  const v = { 
    text: d.text, 
    media: d.media || null, 
    type: d.type || 'text', 
    entities: JSON.parse(d.entities || "[]"), 
    reply_markup: d.buttons ? { inline_keyboard: JSON.parse(d.buttons) } : undefined,
    show_caption_above_media: true // MÍDIA SEMPRE EMBAIXO
  };

  await redis.sadd(`w_list:${gId}`, JSON.stringify(v));
  await redis.del(`w_step:${ctx.from.id}`);
  await redis.del(`w_temp:${ctx.from.id}`);
  
  await ctx.answerCbQuery("Pacto selado com sucesso!");
  await ctx.editMessageText(`${c} <b>RITUAL CONCLUÍDO!</b>`, { 
    parse_mode: "HTML", 
    reply_markup: { inline_keyboard: [[{ text: "🏠 Voltar", callback_data: `cfg_welcome_${gId}` }]] } 
  });
}

// --- [SISTEMA DE VISUALIZAÇÃO DIMENSÃO FANTASMA] ---
if (data.startsWith("w_view_")) {
  const gId = data.replace("w_view_", "");
  try {
    const list = await redis.smembers(`w_list:${gId}`);
    if (!list || list.length === 0) return ctx.answerCbQuery("⚠️ Nenhuma mensagem cadastrada.");
    let msg = `${c} <b>VISUALIZAÇÃO DAS BOAS-VINDAS</b>\n\n<i>Total de registros: ${list.length}</i>\n\n`;
    const buttons = [];
    list.forEach((item, i) => {
      try {
        const d = JSON.parse(item);
        msg += `#${i + 1} → ${(d.text || "").substring(0, 30)}...\n`;
        buttons.push([{ text: `👁️ Ver #${i + 1}`, callback_data: `w_show_${gId}_${i}` }]);
      } catch (err) {}
    });
    buttons.push([{ text: "⬅️ Voltar", callback_data: `cfg_welcome_${gId}` }]);
    await ctx.editMessageText(msg, { parse_mode: "HTML", reply_markup: { inline_keyboard: buttons } });
  } catch (e) { await ctx.answerCbQuery("❌ Erro ao carregar."); }
}

if (data.startsWith("w_show_")) {
  const [, , gId, index] = data.split("_");
  try {
    const list = await redis.smembers(`w_list:${gId}`);
    const item = JSON.parse(list[parseInt(index)]);

    // Prévia real usando Fetch para garantir o layout correto
    const body = {
      chat_id: ctx.chat.id,
      reply_markup: item.reply_markup || undefined,
      show_caption_above_media: true
    };

    let endpoint = "sendMessage";
    if (!item.media || item.type === 'text') {
      body.text = item.text; body.entities = item.entities;
    } else {
      body.caption = item.text; body.caption_entities = item.entities;
      if (item.type === 'photo') endpoint = "sendPhoto", body.photo = item.media;
      else if (item.type === 'video') endpoint = "sendVideo", body.video = item.media;
      else if (item.type === 'animation') endpoint = "sendAnimation", body.animation = item.media;
    }

    await fetch(`https://api.telegram.org/bot${process.env.BOT_TOKEN}/${endpoint}`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body)
    });

    await ctx.reply(`<b>PRÉ-VISUALIZAÇÃO REAL #${parseInt(index)+1}</b>`, { 
      parse_mode: "HTML",
      reply_markup: { inline_keyboard: [[{ text: "⬅️ Voltar", callback_data: `w_view_${gId}` }, { text: "🗑️ Deletar", callback_data: `w_del_${gId}_${index}` }]] }
    });
  } catch (e) { await ctx.answerCbQuery("❌ Erro ao visualizar."); }
}

if (data.startsWith("w_del_")) {
  const [, , gId, index] = data.split("_");
  try {
    const list = await redis.smembers(`w_list:${gId}`);
    await redis.srem(`w_list:${gId}`, list[parseInt(index)]);
    await ctx.answerCbQuery("Registro deletado.");
    return ctx.editMessageReplyMarkup({ inline_keyboard: [[{ text: "🔄 Atualizar Lista", callback_data: `w_view_${gId}` }]] });
  } catch (e) { await ctx.answerCbQuery("❌ Erro ao deletar."); }
}

// ================================
// MENU ANTI-LINK (CEIFADOR PRO FINAL)
// ================================
if (data.startsWith("cfg_links_")) {
  if (!redis) {
    return ctx.answerCbQuery("⚠️ Memória indisponível", { show_alert: true });
  }

  const gId = data.replace("cfg_links_", "");

  const isOn = (await redis.get(`stat:links:${gId}`)) === "on";
  const mode = (await redis.get(`mode:links:${gId}`)) || "warn";
  const time = (await redis.get(`time:links:${gId}`)) || "0";

  const status = isOn ? "🟢 ATIVO" : "🔴 DESLIGADO";

  const modeLabel = {
    delete: "🗑 DELETE",
    warn: "⚠️ WARN",
    mute: "🔇 MUTE",
    kick: "👢 KICK",
    ban: "🚫 BAN"
  }[mode] || "⚠️ WARN";

  const timeLabel = time == "0" ? "♾️ Permanente" : `${time}s`;

  const btn = (text, value) => mode === value ? `🟢 ${text}` : text;

  await ctx.editMessageText(
`${c} <b>SISTEMA ANTI-LINK</b>

Controle o bloqueio automático de links no território.

📊 Status: ${status}
⚙️ Modo: ${modeLabel}
⏱ Tempo: ${timeLabel}`,
    {
      parse_mode: "HTML",
      reply_markup: {
        inline_keyboard: [

          [
            { text: isOn ? "🟢 Ativado" : "🟢 Ativar", callback_data: `links_on_${gId}` },
            { text: !isOn ? "🔴 Desativado" : "🔴 Desativar", callback_data: `links_off_${gId}` }
          ],

          [
            { text: btn("🗑 Delete", "delete"), callback_data: `links_mode_${gId}_delete` },
            { text: btn("⚠️ Warn", "warn"), callback_data: `links_mode_${gId}_warn` }
          ],

          [
            { text: btn("🔇 Mute", "mute"), callback_data: `links_mode_${gId}_mute` },
            { text: btn("👢 Kick", "kick"), callback_data: `links_mode_${gId}_kick` }
          ],

          [
            { text: btn("🚫 Ban", "ban"), callback_data: `links_mode_${gId}_ban` }
          ],

          [
            { text: "30s", callback_data: `links_time_${gId}_30` },
            { text: "5min", callback_data: `links_time_${gId}_300` }
          ],

          [
            { text: "1h", callback_data: `links_time_${gId}_3600` },
            { text: "1d", callback_data: `links_time_${gId}_86400` }
          ],

          [
            { text: "➕ Gerenciar Whitelist", callback_data: `links_white_${gId}` }
          ],

          [
            { text: "⬅️ Voltar", callback_data: `mod_group_${gId}` },
            { text: "🏠 Início", callback_data: "back_start" }
          ]

        ]
      }
    }
  );

  return ctx.answerCbQuery();
}

// ================================
// ATIVAR / DESATIVAR
// ================================
if (data.startsWith("links_on_") || data.startsWith("links_off_")) {
  const parts = data.split("_");
  const action = parts[1];
  const gId = parts[2];

  await redis.set(`stat:links:${gId}`, action === "on" ? "on" : "off");

  await ctx.answerCbQuery(
    action === "on" ? "🟢 Anti-Link ativado" : "🔴 Anti-Link desativado"
  );

  return ctx.editMessageText("🔄 Atualizando...", {
    reply_markup: {
      inline_keyboard: [[{ text: "🔄 Atualizar", callback_data: `cfg_links_${gId}` }]]
    }
  });
}

// ================================
// CONFIG MODO
// ================================
if (data.startsWith("links_mode_")) {
  const [, , gId, mode] = data.split("_");

  const valid = ["delete", "warn", "mute", "kick", "ban"];
  if (!valid.includes(mode)) {
    return ctx.answerCbQuery("❌ Modo inválido");
  }

  await redis.set(`mode:links:${gId}`, mode);

  await ctx.answerCbQuery(`⚙️ Modo definido: ${mode}`);

  return ctx.editMessageText("🔄 Atualizando...", {
    reply_markup: {
      inline_keyboard: [[{ text: "🔄 Atualizar", callback_data: `cfg_links_${gId}` }]]
    }
  });
}

// ================================
// TEMPO
// ================================
if (data.startsWith("links_time_")) {
  const [, , gId, time] = data.split("_");

  await redis.set(`time:links:${gId}`, time);

  await ctx.answerCbQuery("⏱ Tempo definido");

  return ctx.editMessageText("🔄 Atualizando...", {
    reply_markup: {
      inline_keyboard: [[{ text: "🔄 Atualizar", callback_data: `cfg_links_${gId}` }]]
    }
  });
}

// ================================
// ADICIONAR NA BLACKLIST (FUNCIONANDO)
// ================================
if (data === "add_black") {

  await redis.set(`wait_black:${ctx.from.id}`, "1", "EX", 120);

  await ctx.editMessageText(`${c} <b>CONDENAÇÃO INICIADA</b>

Envie agora:

• ID da alma
• ou encaminhe uma mensagem

<i>O Ceifador aguarda...</i>`, {
    parse_mode: "HTML",
    reply_markup: {
      inline_keyboard: [
        [{ text: "❌ Cancelar", callback_data: "view_black" }]
      ]
    }
  });

  return ctx.answerCbQuery();
}

  // --- MENU: AGENTE IA ENTERPRISE ---
  if (data === "menu_ai") {
    await ctx.editMessageText(`${c} <b>🧛 AGENTE IA ENTERPRISE</b>\n\n<i>O Ceifador está processando frequências de inteligência superior...</i>\n\nAs sombras estão aprendendo a analisar almas e automatizar o julgamento no território.\n\n🛡️ <b>Status:</b> Em desenvolvimento nas câmaras do submundo.`, {
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [
          [{ text: "⬅️ Voltar", callback_data: "back_start" }]
        ]
      }
    });
  }

    // --- MENU: MODERAÇÃO (LISTA DE GRUPOS) ---
  if (data === "menu_mod") {
    const grupos = await redis.smembers(`admin_groups:${ctx.from.id}`);
    if (!grupos || grupos.length === 0) {
      return ctx.editMessageText(`${c} <b>Nenhum território vinculado.</b>`, {
        parse_mode: 'HTML',
        reply_markup: { inline_keyboard: [[{ text: "⬅️ Voltar", callback_data: "back_start" }]] }
      });
    }

    const buttons = [];
    for (const gId of grupos) {
      try {
        const chat = await ctx.telegram.getChat(gId);
        buttons.push([{ text: `🛡️ Território: ${chat.title}`, callback_data: `mod_group_${gId}` }]);
      } catch (e) {
        buttons.push([{ text: `❌ ID: ${gId}`, callback_data: `mod_group_${gId}` }]);
      }
    }
    buttons.push([{ text: "⬅️ Voltar", callback_data: "back_start" }]);

    await ctx.editMessageText(`${c} <b>🛡️ Painel de Moderação</b>\n\nSelecione o território para ajustar as sombras:`, {
      parse_mode: 'HTML',
      reply_markup: { inline_keyboard: buttons }
    });
  }
  
// ==========================================
  // MENU BOAS-VINDAS (RECEPÇÃO DE ALMAS)
// ==========================================
if (data.startsWith("cfg_welcome_")) {
  try {
    const gId = data.replace("cfg_welcome_", "");

    let gName = "Território";
    try {
      const chat = await ctx.telegram.getChat(gId);
      gName = chat.title;
    } catch {}

    let statusRaw = "off";
    let modeRaw = "single";
    let count = 0;

    try {
      statusRaw = await redis.get(`stat:welcome:${gId}`) || "off";
      modeRaw = await redis.get(`mode:welcome:${gId}`) || "single";
      count = await redis.scard(`w_list:${gId}`) || 0;
    } catch (e) {
      console.log("Redis erro:", e.message);
    }

    const status = statusRaw === "on" ? "🟢 ATIVO" : "🔴 DESLIGADO";
    const mode = modeRaw === "random" ? "🎲 CICLO" : "📍 ÚNICO";

    await ctx.editMessageText(
      `${c} <b>RECEPÇÃO DE ALMAS (BOAS-VINDAS)</b>\n\n` +
      `🏠 Território: <b>${gName}</b>\n` +
      `📊 Status: ${status}\n` +
      `🎛️ Modo: ${mode}\n` +
      `📦 Registros: <b>${count}</b>\n\n` +
      `<i>Escolha a natureza do compromisso:</i>`,
      {
        parse_mode: "HTML",
        reply_markup: {
          inline_keyboard: [
            [
              { text: `⚡ ${status}`, callback_data: `w_toggle_${gId}` },
              { text: `🎛️ ${mode}`, callback_data: `w_mode_${gId}` }
            ],
            [{ text: "🩸 Pacto de Sangue (Clone)", callback_data: `w_add_${gId}` }],
            [{ text: "📜 Ritual de Boas-Vindas (Contrato)", callback_data: `w_ritual_${gId}` }],
            [{ text: "🕸️ Pacto Hereditário (Sintaxe)", callback_data: `w_add_rose_${gId}` }],
            [{ text: "👁️ Visualizar Boas-Vindas", callback_data: `w_view_${gId}` }],
            [{ text: "🗑️ Obliteração (Apagar Tudo)", callback_data: `w_clear_${gId}` }],
            [{ text: "🔄 Sincronizar (Atualizar)", callback_data: `cfg_welcome_${gId}` }],
            [
              { text: "⬅️ Recuar (Voltar)", callback_data: `mod_group_${gId}` },
              { text: "🏠 Vazio (Início)", callback_data: "back_start" }
            ]
          ]
        }
      }
    );

  } catch (e) {
    console.log("Erro no cfg_welcome:", e.message);
    await ctx.answerCbQuery("❌ Erro ao atualizar menu").catch(() => {});
  }

  return;
}

// ================================
// TOGGLE ON/OFF
// ================================
if (data.startsWith("w_toggle_")) {
  const gId = data.replace("w_toggle_", "");
  const cur = await redis.get(`stat:welcome:${gId}`);
  await redis.set(`stat:welcome:${gId}`, cur === "on" ? "off" : "on");

  return ctx.answerCbQuery("Status atualizado").then(() =>
    ctx.editMessageReplyMarkup({
      inline_keyboard: [[{ text: "🔄 Atualizar Menu", callback_data: `cfg_welcome_${gId}` }]]
    })
  );
}


// ================================
// TOGGLE MODO
// ================================
if (data.startsWith("w_mode_")) {
  const gId = data.replace("w_mode_", "");
  const cur = await redis.get(`mode:welcome:${gId}`);
  await redis.set(`mode:welcome:${gId}`, cur === "random" ? "fixed" : "random");

  return ctx.answerCbQuery("Modo alterado").then(() =>
    ctx.editMessageReplyMarkup({
      inline_keyboard: [[{ text: "🔄 Atualizar Menu", callback_data: `cfg_welcome_${gId}` }]]
    })
  );
}


// ================================
// ADD BRUTUS (SEU PADRÃO ATUAL)
// ================================
if (data.startsWith("w_add_") && !data.startsWith("w_add_rose_")) {
  const gId = data.replace("w_add_", "");
  await redis.set(`w_waiting:${ctx.from.id}`, gId);
  await ctx.editMessageText(
    `${c} <b>MOLDANDO A RECEPÇÃO...</b>\n\n` +
    `✔ Texto (Selar o Pacto)\n` +
    `✔ Mídia (Prelúdio da sentença)\n` +
    `✔ Botões (Senda para o obscuro)\n\n` +
    `<i>O Ceifador irá subjulgar e selar cada rastro desta mensagem.</i>`,
    {
      parse_mode: "HTML",
      reply_markup: {
        inline_keyboard: [
          [{ text: "❌ Interromper Ritual", callback_data: `cfg_welcome_${gId}` }]
        ]
      }
    }
  );
}


// ================================
// ADD ROSE (MODO GUIADO)
// ================================
if (data.startsWith("w_add_rose_")) {
  const gId = data.replace("w_add_rose_", "");

  await redis.set(`w_waiting:${ctx.from.id}`, gId);

  await ctx.editMessageText(
`${c} <b>MODO ROSE ATIVADO</b>

Envie a mensagem usando formato:

[Texto](buttonurl://link)

Ou:

[Texto](buttonurl#style://link)

<i>Compatível com sistema híbrido.</i>`,
    {
      parse_mode: "HTML",
      reply_markup: {
        inline_keyboard: [
          [{ text: "❌ Cancelar", callback_data: `cfg_welcome_${gId}` }]
        ]
      }
    }
  );
}


// ================================
// LIMPAR BANCO
// ================================
if (data.startsWith("w_clear_")) {
  const gId = data.replace("w_clear_", "");

  await redis.del(`w_list:${gId}`);

  await ctx.answerCbQuery("Banco limpo com sucesso");

  return ctx.editMessageReplyMarkup({
    inline_keyboard: [[{ text: "🔄 Atualizar Menu", callback_data: `cfg_welcome_${gId}` }]]
  });
}
  if (data.startsWith("mod_group_")) {
    const gId = data.replace("mod_group_", "");
    let groupName = "Território";
    try { const chat = await ctx.telegram.getChat(gId); groupName = chat.title; } catch (e) {}

    const st = async (key) => (await redis.get(`stat:${key}:${gId}`)) === "on" ? "🟢" : "🔴";

    await ctx.editMessageText(`${c} <b>PAINEL: ${groupName}</b>\nID: <code>${gId}</code>\n\n<i>Ajuste as frequências do submundo:</i>`, {
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [
          [{ text: `${await st("welcome")} Boas-Vindas`, callback_data: `cfg_welcome_${gId}` }, { text: `${await st("notes")} Notas (#)`, callback_data: `cfg_notes_${gId}` }],
          [{ text: `${await st("filters")} Filtros`, callback_data: `cfg_filters_${gId}` }, { text: `${await st("links")} Anti-Link`, callback_data: `cfg_links_${gId}` }],
          [{ text: `${await st("clean")} Limpeza`, callback_data: `cfg_clean_${gId}` }],
          [{ text: "⬅️ Voltar ao Início", callback_data: "menu_mod" }]
        ]
      }
    });
  }

  // --- [SISTEMA]: NÚCLEO DO CEIFADOR ---
  if (data === "menu_sys") {
    await ctx.editMessageText(`${c} <b>⚙️ NÚCLEO DO CEIFADOR</b>\n\nConfigure as defesas e as leis do submundo:`, {
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [
          [{ text: "⛓️ Territórios (Links)", callback_data: "view_white" }],
          [{ text: "🚫 Almas (Blacklist)", callback_data: "view_black" }],
          [{ text: "⬅️ Voltar ao Início", callback_data: "back_start" }]
        ]         
      }
    });
  }

  // --- [WHITELIST]: VISUALIZAR LISTA ---
  if (data === "view_white") {
    const list = await redis.smembers("whitelist_links") || [];
    let msg = `${c} <b>⛓️ TERRITÓRIOS SUBJUGADOS</b>\n\n<i>Canais e Links permitidos pelo Ceifador:</i>\n\n`;
    list.length === 0 ? msg += "<i>Nenhum pacto firmado.</i>" : list.forEach((l, i) => msg += `${i+1}. <code>${l}</code>\n`);
    
    await ctx.editMessageText(msg, {
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [
          [{ text: "➕ Adicionar Link", callback_data: "add_white" }],
          [{ text: "🗑️ Limpar Tudo", callback_data: "conf_clear_white" }],
          [{ text: "⬅️ Voltar", callback_data: "menu_sys" }]
        ]
      }
    });
  }

  // --- [BLACKLIST]: ALMAS CONDENADAS ---
  if (data === "view_black") {
    const list = await redis.smembers("blacklist_ids") || [];
    let msg = `${c} <b>🚫 ALMAS CONDENADAS</b>\n\n<i>IDs banidos permanentemente do Vazio:</i>\n\n`;
    list.length === 0 ? msg += "<i>Nenhuma alma sentenciada.</i>" : list.forEach((l, i) => msg += `${i+1}. <code>${l}</code>\n`);

    await ctx.editMessageText(msg, {
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [
          [{ text: "➕ Condenar ID", callback_data: "add_black" }],
          [{ text: "🗑️ Perdoar Todas", callback_data: "conf_clear_black" }],
          [{ text: "⬅️ Voltar", callback_data: "menu_sys" }]
        ]
      }
    });
  }

  // --- [CONFIRMAÇÃO DE LIMPEZA]: SEGURANÇA CONTRA ERROS ---
  if (data.startsWith("conf_clear_")) {
    const tipo = data.replace("conf_clear_", "");
    const alvo = tipo === "white" ? "Whitelist" : "Blacklist";
    await ctx.editMessageText(`${c} <b>⚠️ AVISO DO SUBMUNDO!</b>\n\nSilvio, você tem certeza que deseja apagar TODA a <b>${alvo}</b>?\nEsta ação não pode ser desfeita.`, {
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [
          [{ text: "🔥 SIM, APAGAR!", callback_data: `execute_clear_${tipo}` }],
          [{ text: "❌ CANCELAR", callback_data: `view_${tipo}` }]
        ]
      }
    });
  }

  // --- [EXECUÇÃO DA LIMPEZA] ---
  if (data.startsWith("execute_clear_")) {
    const tipo = data.replace("execute_clear_", "");
    await redis.del(tipo === "white" ? "whitelist_links" : "blacklist_ids");
    await ctx.answerCbQuery("O rastro foi apagado das sombras.");
    await ctx.editMessageText(`${c} <b>Obliteração concluída.</b>\nAs listas voltaram ao estado virgem.`, {
      parse_mode: 'HTML',
      reply_markup: { inline_keyboard: [[{ text: "⬅️ Voltar", callback_data: `view_${tipo}` }]] }
    });
  }

});

// SETLOG
bot.command("setlog", async (ctx) => {
  if (!redis) return ctx.reply("Memória indisponível.");
  if (ctx.chat.type === "group" || ctx.chat.type === "supergroup") {
    await redis.set(`pending_log:${ctx.from.id}`, ctx.chat.id);
    await redis.sadd(`admin_groups:${ctx.from.id}`, ctx.chat.id);
    await ctx.reply(`${c} <b>O Ceifador reconheceu este território...</b>\n\nAgora vá ao privado do bot e envie /setlog para continuar.`, { parse_mode: 'HTML' });
    return;
  }
  if (ctx.chat.type === "private") {
    const chatId = await redis.get(`pending_log:${ctx.from.id}`);
    if (!chatId) return ctx.reply(`${c} <b>Nenhum território pendente.</b>\n\nUse /setlog em um grupo primeiro.`, { parse_mode: 'HTML' });
    await redis.set(`log_wait:${ctx.from.id}`, chatId);
    await ctx.reply(`${c} <b>O Ceifador aguarda o canal...</b>\n\nEncaminhe uma mensagem do canal para selar o pacto.`, { parse_mode: 'HTML' });
  }
});

// DELLOG
bot.command("dellog", async (ctx) => {
  if (ctx.chat.type !== "private") return;
  if (!redis) return;
  const chatId = await redis.get(`pending_log:${ctx.from.id}`);
  if (!chatId) return ctx.reply(`${c} <b>Nenhum território selecionado.</b>`, { parse_mode: 'HTML' });
  await redis.del(`log_channel:${chatId}`);
  await ctx.reply(`${c} <b>Pacto quebrado.</b>\n\nEste território não será mais observado.`, { parse_mode: 'HTML' });
});

bot.on(['text', 'caption', 'photo', 'video'], async (ctx) => {
  if (!ctx.message || ctx.message.from?.is_bot) return;
 const m = ctx.message;
 
 // ================================
// AUTO LIMPEZA DE COMANDOS
// ================================
if (redis && ctx.chat.type !== "private") {
  const text = ctx.message.text || ctx.message.caption || "";

  if (/^[\/!.]/.test(text)) {
    const isAdm = await isAdmin(ctx);

    const key = isAdm
      ? `clean:admin:${ctx.chat.id}`
      : `clean:user:${ctx.chat.id}`;

    const status = await redis.get(key);

    if (status === "on") {
      await ctx.deleteMessage().catch(() => {});
    }
  }
}
  // --- CACHE DE USUÁRIOS (ID + USERNAME) ---
if (redis && m.from) {
  const userId = m.from.id;

  // salva por ID sempre
  await redis.set(`user:id:${userId}`, JSON.stringify(m.from)).catch(() => {});

  // salva username se existir
  if (m.from.username) {
    const username = m.from.username.toLowerCase();
    await redis.set(`user:username:${username}`, userId).catch(() => {});
  }
}

  // --- MOTOR DE SUBJUGAÇÃO E CONDENAÇÃO (PRIVADO) ---
  if (ctx.chat.type === "private" && (await isAdmin(ctx))) {
    const waitW = await redis.get(`wait_white:${ctx.from.id}`);
    const waitB = await redis.get(`wait_black:${ctx.from.id}`);

    if (waitW || waitB) {
      let rastro = (m.text || m.caption || "").toLowerCase().trim();
      if (m.forward_from_chat) rastro = m.forward_from_chat.id.toString();
      
      const lista = waitW ? "whitelist_links" : "blacklist_ids";
      const acao = waitW ? "SUBJUGAÇÃO" : "CONDENAÇÃO";

      await redis.sadd(lista, rastro);
      await redis.del(waitW ? `wait_white:${ctx.from.id}` : `wait_black:${ctx.from.id}`);
      
      return ctx.reply(`${c} <b>PACTO FIRMADO!</b>\n\nA <b>${acao}</b> do rastro <code>${rastro}</code> foi registrada no banco das sombras.`, { parse_mode: 'HTML' });
    }
  }

  const text = m.text || m.caption || "";
  const chatId = ctx.chat.id;
  const target = await getTarget(ctx);
    // --- VIGILANTE DO ABISMO (BLACKLIST) ---
  if (redis && ctx.chat.type !== "private") {
    const blackList = await redis.smembers("blacklist_ids") || [];
    if (blackList.includes(m.from.id.toString())) {
      await ctx.telegram.banChatMember(chatId, m.from.id).catch(() => {});
      await ctx.deleteMessage().catch(() => {});
      return ctx.reply(`${c} <b>SENTENÇA FINAL</b>\n\nA alma <b>${m.from.first_name}</b> consta no registro das <b>Almas Condenadas</b> e foi expurgada para o Vazio.`, { parse_mode: 'HTML' });
    }
  }

    // =========================================================
  // [MÓDULO] MONITOR DE PACTOS: BOAS-VINDAS (ETAPAS DO CONTRATO)
  // =========================================================
  const ritualStep = await redis.get(`w_step:${ctx.from.id}`);
  const waitingGid = await redis.get(`w_waiting:${ctx.from.id}`);

  if ((ritualStep || waitingGid) && ctx.chat.type === "private") {
    const m = ctx.message;
    const textInput = m.text || m.caption || "";
    const mediaId = m.photo ? m.photo[m.photo.length - 1].file_id : (m.video || m.animation || {}).file_id;
    const type = m.photo ? 'photo' : (m.video ? 'video' : (m.animation ? 'animation' : null));

    // --- ETAPA DO CONTRATO ---
    if (ritualStep) {
      const [stage, gId] = ritualStep.split(":");
      
      if (stage === "txt") {
        const cleaned = (m.entities || m.caption_entities || []).map(ent => {
          const { user, ...rest } = ent; return rest;
        });
        await redis.hset(`w_temp:${ctx.from.id}`, "text", textInput, "entities", JSON.stringify(cleaned));
        await redis.set(`w_step:${ctx.from.id}`, `med:${gId}`);
        return ctx.reply(`${c} <b>TEXTO SELADO!</b>\nEnvie a <b>MÍDIA</b> ou /pular.`);
      }

      if (stage === "med") {
        if (textInput !== "/pular" && mediaId) await redis.hset(`w_temp:${ctx.from.id}`, "media", mediaId, "type", type);
        await redis.set(`w_step:${ctx.from.id}`, `btn:${gId}`);
        return ctx.reply(`${c} <b>MÍDIA REGISTRADA!</b>\nEnvie os botões (Nome - Link) ou /pular.`);
      }

      if (stage === "btn") {
        if (textInput !== "/pular") {
          let buttons = [];
          textInput.split('\n').forEach(line => {
            const row = [];
            line.split('&&').forEach(p => {
              const [t, l] = p.split(' - ');
              if (t && l) {
                let s = "primary"; let label = t.trim();
                if (label.includes("#r")) { s = "danger"; label = label.replace("#r", "").trim(); }
                if (label.includes("#g")) { s = "success"; label = label.replace("#g", "").trim(); }
                if (label.includes("#p")) { s = "primary"; label = label.replace("#p", "").trim(); }
                row.push({ text: label, url: l.trim(), style: s });
              }
            });
            if (row.length > 0) buttons.push(row);
          });
          await redis.hset(`w_temp:${ctx.from.id}`, "buttons", JSON.stringify(buttons));
        }
        await redis.del(`w_step:${ctx.from.id}`);
        return ctx.reply(`${c} <b>PRONTO!</b>\nVolte ao menu e clique em <b>🔥 SELAR PACTO</b>.`, { 
          reply_markup: { inline_keyboard: [[{ text: "📜 Voltar ao Menu", callback_data: `w_ritual_${gId}` }]] } 
        });
      }
    }

    // --- PACTO DE SANGUE (CLONAGEM) ---
    if (waitingGid) {
      if (!m.reply_to_message) return ctx.reply("Responda à mensagem!");
      const msg = m.reply_to_message;
      const entities = (msg.entities || msg.caption_entities || []).map(ent => { const { user, ...rest } = ent; return rest; });
      const mId = msg.photo ? msg.photo[msg.photo.length - 1].file_id : (msg.video || msg.animation || {}).file_id;
      const v = { text: msg.text || msg.caption || "", media: mId || null, type: msg.photo ? 'photo' : (msg.video ? 'video' : (msg.animation ? 'animation' : 'text')), entities: entities, reply_markup: msg.reply_markup, show_caption_above_media: true };
      await redis.sadd(`w_list:${waitingGid}`, JSON.stringify(v));
      await redis.del(`w_waiting:${ctx.from.id}`);
      return ctx.reply("<b>DNA CLONADO!</b>", { reply_markup: { inline_keyboard: [[{ text: "🏠 Menu", callback_data: `cfg_welcome_${waitingGid}` }]] } });
    }
  }

  const reply = m.reply_to_message;
  const isAdm = await isAdmin(ctx);

  // CAPTURA DO CANAL
  if (ctx.chat.type === "private" && redis) {
    const waitingChat = await redis.get(`log_wait:${ctx.from.id}`);
    if (waitingChat) {
      if (!m.forward_from_chat) {
        await ctx.reply(`${c} <b>Envie uma mensagem encaminhada válida.</b>`, { parse_mode: 'HTML' });
        return;
      }
      const channelId = m.forward_from_chat.id;
      await redis.set(`log_channel:${waitingChat}`, channelId);
      await redis.del(`log_wait:${ctx.from.id}`);
      await redis.del(`pending_log:${ctx.from.id}`);
      await ctx.reply(`${c} <b>Pacto selado.</b>\n\nO Ceifador agora observa este território.`, { parse_mode: 'HTML' });
      return;
    }
  }
  
// ================================
// ANTI-LINK (CORREÇÃO DEFINITIVA)
// ================================

if (redis && ctx.chat.type !== "private") {

  const textMsg = (m.text || m.caption || "").toLowerCase();

  // SÓ EXECUTA SE TIVER LINK
  if (/(https?:\/\/|t\.me|www\.)/i.test(textMsg)) {

    const whitelist = await redis.smembers("whitelist_links") || [];
    if (whitelist.some(w => textMsg.includes(w))) return;

    if (isAdm) return;

    const mode = (await redis.get(`mode:links:${chatId}`)) || "warn";
    const duration = parseInt(await redis.get(`time:links:${chatId}`)) || 0;

    const uId = m.from.id;
    const info = formatUser(m.from);

    // DELETE
    if (mode === "delete") {
      await ctx.deleteMessage().catch(() => {});
    }

    // WARN
    else if (mode === "warn") {
      await ctx.deleteMessage().catch(() => {});

      const key = `warns:${chatId}:${uId}`;
      let w = parseInt(await redis.get(key)) || 0;
      w++;

      await redis.set(key, w);

      const limit = parseInt(await redis.get(`warn:limit:${chatId}`)) || 4;

      if (w < limit) {
        await ctx.reply(`${c} <b>O Ceifador marcou esta alma...</b>

Usuário:
<b>${info}</b>
Motivo: envio de link
Warn: ${w}/${limit}`, { parse_mode: 'HTML' });
      } else {
        await redis.del(key);
      }
    }

    // MUTE
    else if (mode === "mute") {
      await ctx.deleteMessage().catch(() => {});

      const until = duration > 0
        ? Math.floor(Date.now() / 1000) + duration
        : 0;

      await ctx.telegram.restrictChatMember(chatId, uId, {
        permissions: { can_send_messages: false },
        until_date: until || undefined
      }).catch(() => {});

      await ctx.reply(`${c} <b>O Ceifador silenciou esta alma...</b>`, { parse_mode: 'HTML' });
    }

    // KICK
    else if (mode === "kick") {
      await ctx.deleteMessage().catch(() => {});

      await ctx.telegram.banChatMember(chatId, uId).catch(() => {});
      await ctx.telegram.unbanChatMember(chatId, uId).catch(() => {});

      await ctx.reply(`${c} <b>O Ceifador expulsou esta alma...</b>`, { parse_mode: 'HTML' });
    }

    // BAN
    else if (mode === "ban") {
      await ctx.deleteMessage().catch(() => {});

      await ctx.telegram.banChatMember(chatId, uId).catch(() => {});

      await ctx.reply(`${c} <b>O Ceifador baniu esta alma...</b>`, { parse_mode: 'HTML' });
    }

  }
}

  // --- HELP OBLITERAÇÃO (DIMENSÃO FANTASMA) ---
  if (text.startsWith("/help")) {
    const h = `${c} <b>👁️ O Ceifador revela seus poderes...</b>\n\n` +
      `<b>🔎 Identificação</b>\n/id — Revela a essência da alma\n/staff — Mostra os sentinelas do território\n/chatid — ID deste território\n\n` +
      `<b>⚖️ Julgamento</b>\n/warn — Marcar uma alma\n/unwarn — Remover uma marca\n/mute — Condenar ao silêncio\n/unmute — Devolver a voz\n/ban — Banir para o abismo\n/kick — Expulsar do território\n\n` +
      `<b>💥 Obliteração do Submundo (Apaga + Pune)</b>\n/del — Apagar apenas o vestígio\n/delwarn — Obliteração e advertência\n/delmute — Obliteração e silenciamento\n/delban — Obliteração e banimento\n\n` +
      `<b>📝 Registros</b>\n/resetwarn — Purificar todas as marcas\n\n` +
      `<b>🎙️ Manifestação</b>\n/say — A voz soberana do Ceifador\n\n` +
      `<b>📡 Sistema</b>\n/ping — Status da conexão\n/setlog — Selar pacto de logs\n/dellog — Quebrar pacto de logs\n\n` +
      `<b>👑 Soberania</b>\n/promote — Elevar a Sentinela\n/demote — Rebaixar a alma comum\n\n` +
      `💡 <i>Invoque a Staff usando <b>@admin</b> em qualquer lugar.</i>`;

    await ctx.reply(h, { parse_mode: 'HTML' });
    return ctx.deleteMessage().catch(() => {});
  }

    // --- @ADMIN (VIGILANTE COM @ AZUL EXTERNO - ESTILO BRUTUS) ---
  if (text.toLowerCase().includes("@admin")) {
    const isAdm = await isAdmin(ctx);
    if (isAdm) return; 

    try {
      const adms = await ctx.telegram.getChatAdministrators(chatId);
      const idsAdms = adms.filter(a => !a.user.is_bot).map(a => a.user.id);
      
      // O segredo do balão azul na lista de chats:
      const mencoes = idsAdms.map(id => `<a href="tg://user?id=${id}">@admin</a>`).join(" ");

      await ctx.reply(`${c} <b>(INVOCANDO O SUBMUNDO)</b>\n\n⚖️ ${mencoes} <i>chamado! As trevas clamam por justiça.</i>`, { 
        parse_mode: 'HTML', 
        reply_to_message_id: m.message_id 
      });

      const chatLimpo = chatId.toString().replace("-100", "");
      const linkMsg = `https://t.me/c/${chatLimpo}/${m.message_id}`;
      
      for (const adminId of idsAdms) {
        const alerta = `<a href="tg://user?id=${adminId}">​​</a>${c} <b>⚠️ ALERTA DO SUBMUNDO!</b>\n\nA alma <a href="tg://user?id=${m.from.id}"><b>${m.from.first_name}</b></a> clama por justiça no território: <b>${ctx.chat.title}</b>\n\n📄 <b>Relato:</b> <code>@admin</code> ${text.replace(/@admin/gi, "").trim()}`;
        
        const teclado = { 
          inline_keyboard: [
            [{ text: "🔗 Ir para a Mensagem", url: linkMsg }], 
            [{ text: "⚖️ Julgar Alma", callback_data: `report_julgar` }] 
          ] 
        };

        await ctx.telegram.sendMessage(adminId, alerta, { 
          parse_mode: 'HTML', 
          reply_markup: teclado 
        }).catch(() => {});
      }
    } catch (e) { console.log("Erro no @admin:", e.message); }
  }


  // PING
  if (text.startsWith("/ping")) {
    let s = "Offline ❌";
    if (redis) {
      try { const t = await redis.ping(); if (t === "PONG") s = "Online ✅"; } catch {}
    }
    await ctx.reply(`${c} <b>O Ceifador observa... e responde.</b>\n<b>Memória:</b> ${s}`, { parse_mode: 'HTML' });
    return ctx.deleteMessage().catch(() => {});
  }

  // CHATID
  if (text.startsWith("/chatid")) {
    await ctx.reply(`${c} <b>ID do Território:</b>\n<code>${chatId}</code>`, { parse_mode: 'HTML' });
    return ctx.deleteMessage().catch(() => {});
  }

  // ID
  if (text.startsWith("/id")) {
    let target = reply ? reply.from : m.from;
    await ctx.reply(`${c} <b>O Ceifador revelou a identidade desta alma...</b>\n\nUsuário:\n<b>${formatUser(target)}</b>`, {
      parse_mode: 'HTML',
      reply_to_message_id: reply ? reply.message_id : null
    });
    return ctx.deleteMessage().catch(() => {});
  }

  // STAFF
  if (text.startsWith("/staff")) {
    const adms = await ctx.telegram.getChatAdministrators(chatId);
    let l = `${c} <b>O Ceifador revelou os responsáveis por este território...</b>\n\n`;
    adms.forEach(a => { if (!a.user.is_bot) l += `• ${formatUser(a.user)}\n\n`; });
    await ctx.reply(l, { parse_mode: 'HTML' });
  return ctx.deleteMessage().catch(() => {});
  }

  // BLOQUEIO
  const cmdAdm = ["/say", "/warn", "/unwarn", "/resetwarn", "/mute", "/unmute", "/ban", "/kick", "/del", "/promote", "/demote"];
  if (cmdAdm.some(x => text.startsWith(x)) && !isAdm) {
    const av = await ctx.reply(`${c} <b>Nem toda alma é digna de invocar o poder do Ceifador...</b>`, { parse_mode: 'HTML' });
   setTimeout(() => ctx.telegram.deleteMessage(chatId, av.message_id).catch(() => {}), 5000);

    return ctx.deleteMessage().catch(() => {});
  }

  if (!isAdm) return;

    // --- [SISTEMA]: PROTEÇÃO GLOBAL (CORRIGIDO) ---
  const punishCommands = ["/warn", "/mute", "/ban", "/kick", "/unwarn", "/rewarn"];
  if (reply && punishCommands.some(cmd => text.startsWith(cmd))) {
    const member = await ctx.telegram.getChatMember(chatId, reply.from.id).catch(() => ({ status: "" }));
    const targetIsAdmin = ["creator", "administrator"].includes(member.status);
    if (reply.from.is_bot || targetIsAdmin) {
      const av = await ctx.reply(`${c} <b>Essa alma não pode ser ceifada.</b>`, { parse_mode: 'HTML' });
      setTimeout(() => ctx.telegram.deleteMessage(chatId, av.message_id).catch(() => {}), 5000);
      return ctx.deleteMessage().catch(() => {});
    }
  }


// --- [COMANDO: /SAY SUPREMO - VERSÃO FINAL COM TODAS AS TAGS] ---
if ((m.text || m.caption || "").startsWith("/say") && (await isAdmin(ctx))) {
  try {
    const ori = m.text || m.caption || "";
    const space = ori.indexOf(' ');
    const cmdL = space === -1 ? ori.length : space + 1;
    let clean = ori.slice(cmdL);
    
    const u = m.reply_to_message ? m.reply_to_message.from : m.from;
    const now = new Date();
    const fullN = `${u.first_name || ""} ${u.last_name || ""}`.trim();
    const rulesL = `https://t.me/c/${ctx.chat.id.toString().replace("-100", "")}/1`;

    const tags = {
      '{ID}': u.id, '{id}': u.id,
      '{NAME}': u.first_name || "", '{name}': u.first_name || "",
      '{FIRST}': u.first_name || "", '{first}': u.first_name || "",
      '{SURNAME}': u.last_name || "", '{surname}': u.last_name || "",
      '{NAMESURNAME}': fullN, '{namesurname}': fullN,
      '{USERNAME}': u.username ? `@${u.username}` : "n/a", '{username}': u.username ? `@${u.username}` : "n/a",
      '{MENTION}': u.first_name, '{mention}': u.first_name,
      '{GROUPNAME}': ctx.chat.title || "", '{groupname}': ctx.chat.title || "",
      '{LANG}': u.language_code || "pt-br", '{lang}': u.language_code || "pt-br",
      '{DATE}': now.toLocaleDateString("pt-BR"), '{date}': now.toLocaleDateString("pt-BR"),
      '{TIME}': now.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }), '{time}': now.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
      '{WEEKDAY}': now.toLocaleDateString("pt-BR", { weekday: "long" }), '{weekday}': now.toLocaleDateString("pt-BR", { weekday: "long" }),
      '{RULES}': rulesL, '{rules}': rulesL
    };

    Object.keys(tags).forEach(t => { clean = clean.split(t).join(tags[t]); });

    let btns = [];
    const styles = { r: "danger", g: "success", p: "primary" };
    let ents = m.entities || m.caption_entities || [];
    let fEnts = ents.filter(e => e.offset >= cmdL).map(e => ({ ...e, offset: e.offset - cmdL }));
    
    const mentionIdx = clean.indexOf(u.first_name);
    if (mentionIdx !== -1) {
      fEnts.push({ type: 'text_link', offset: mentionIdx, length: u.first_name.length, url: `tg://user?id=${u.id}` });
    }

    // CORRIGIDO: busca o emoji no texto ORIGINAL antes das substituições de tags
    const getE = (txtBtn) => {
      const offOriginal = ori.indexOf(txtBtn);
      if (offOriginal === -1) return null;
      const e = ents.find(en =>
        en.type === "custom_emoji" &&
        en.offset >= offOriginal &&
        en.offset < offOriginal + txtBtn.length
      );
      return e ? e.custom_emoji_id : null;
    };

    const lines = clean.split('\n');
    lines.forEach(line => {
      const row = [];
      const regA = /\{\[(?:#([rgp]) )?(.*?) - (.*?)\]\}/g;
      const regB = /\[(.*?)\]\(buttonurl(?:#(\w+))?:\/\/(.*?)(?::same)?\)/g;
      let match;
      
      const addB = (st, txt, url) => {
        let b = { text: txt.trim() };
        const eId = getE(txt);
        if (eId) {
          b.icon_custom_emoji_id = eId;
          // CORRIGIDO: só substitui o texto se o resultado não ficar vazio
          const semEmoji = b.text.replace(/[\uD800-\uDBFF][\uDC00-\uDFFF]/g, "").trim();
          if (semEmoji.length > 0) b.text = semEmoji;
        }
        if (url.startsWith("alert:") || url.startsWith("popup:")) {
          const isFull = url.startsWith("alert:");
          const msg = url.replace(/alert:|popup:/, "").trim();
          const cb = `alert${isFull ? "_AL_" : "_PP_"}${Buffer.from(msg).toString('base64').slice(0, 15)}`;
          b.callback_data = cb;
          if (redis) redis.set(`alert_msg:${cb}`, msg, 'EX', 3600);
        } else if (url.startsWith("share:")) {
          b.url = `https://t.me/share/url?url=${encodeURIComponent(url.replace("share:", ""))}`;
        } else if (url.startsWith("copy:")) {
          b.callback_data = `copy_${Buffer.from(url.replace("copy:", "")).toString('base64')}`;
        } else if (url === "del") {
          b.callback_data = "del_msg";
        } else {
          b.url = url.trim();
        }
        
        if (st) b.style = styles[st] || st;
        row.push(b);
      };

      while ((match = regA.exec(line)) !== null) addB(match[1], match[2], match[3]);
      while ((match = regB.exec(line)) !== null) addB(match[2], match[1], match[3]);
      if (row.length > 0) btns.push(row);
    });

    const fTxt = clean.replace(/\{\[(?:#[rgp] )?(.*?) - (.*?)\]\}/g, "").replace(/\[(.*?)\]\(buttonurl(?:#\w+)?:\/\/(.*?)(?::same)?\)/g, "").trim();

// Remove entities cujo offset ultrapassa o tamanho do texto final
fEnts = fEnts.filter(e => e.offset + e.length <= fTxt.length);
    
    const body = { 
      chat_id: ctx.chat.id, text: fTxt, entities: fEnts.length > 0 ? fEnts : undefined,
      reply_to_message_id: m.reply_to_message?.message_id, 
      reply_markup: btns.length > 0 ? { inline_keyboard: btns } : undefined, 
      show_above_text: true, expand_media_caption: true 
    };

    let endP = "sendMessage";
    if (m.photo) {
      endP = "sendPhoto";
      body.photo = m.photo[m.photo.length - 1].file_id;
    } else if (m.video || m.animation) {
      endP = m.video ? "sendVideo" : "sendAnimation";
      body[m.video ? "video" : "animation"] = (m.video || m.animation).file_id;
    } else if (m.audio || m.voice) {
      endP = "sendAudio";
      body[m.audio ? "audio" : "voice"] = (m.audio || m.voice).file_id;
    }
    
    if (endP !== "sendMessage") {
      body.caption = body.text;
      body.caption_entities = body.entities;
      delete body.text;
      delete body.entities;
    }
    
    await fetch(`https://api.telegram.org/bot${process.env.BOT_TOKEN}/${endP}`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body)
    });
const resultado = await resposta.json();
console.log("SAY RESULTADO:", JSON.stringify(resultado));
console.log("SAY BODY:", JSON.stringify(body));
    await ctx.deleteMessage().catch(() => {});
  } catch (err) { console.log("Erro no Say:", err.message); }
  return;
}
// =======================
// COMANDO: /warn (NOVO)
// =======================
if (text.startsWith("/warn")) {
  if (!redis) return ctx.reply(`${c} Memória indisponível.`);

  if (!target) {
    return ctx.reply(`${c} <b>Você precisa indicar uma alma.</b>\n\nUse:\n• Resposta\n• /warn ID\n• /warn @username`, { parse_mode: 'HTML' });
  }

  const uId = target.id;
  const key = `warns:${chatId}:${uId}`;

  let w = parseInt(await redis.get(key)) || 0;
  w++;
  await redis.set(key, w);

  const mot = getMotivo(text, "/warn");
  const info = formatUser(target);
  const limit = parseInt(await redis.get(`warn:limit:${chatId}`)) || 4;
  const action = (await redis.get(`warn:action:${chatId}`)) || "ban";

  if (w === 1) {
    await ctx.reply(`${c} <b>O Ceifador marcou esta alma...</b>\n\nUsuário:\n<b>${info}</b>\nMotivo: ${mot}\nWarn: 1/${limit}`, { parse_mode: 'HTML' });
  } else if (w === 2) {
    await ctx.reply(`${c} <b>O Ceifador já marcou sua alma mais de uma vez...</b>\n\nUsuário:\n<b>${info}</b>\nMotivo: ${mot}\nWarn: 2/${limit}`, { parse_mode: 'HTML' });
  } else if (w === 3) {
    await ctx.reply(`${c} <b>O Ceifador já não ignora mais sua existência...</b>\n\nUsuário:\n<b>${info}</b>\nMotivo: ${mot}\nWarn: 3/${limit}`, { parse_mode: 'HTML' });
  } else if (w < limit) {
    await ctx.reply(`${c} <b>O Ceifador observa... e não esquece.</b>\n\nUsuário:\n<b>${info}</b>\nMotivo: ${mot}\nWarn: ${w}/${limit}`, { parse_mode: 'HTML' });
  } else {
    if (action === "ban") {
      await ctx.telegram.banChatMember(chatId, uId);
      await ctx.reply(`${c} <b>O Ceifador julgou esta alma...</b>\n\nEla ultrapassou os limites e foi banida.\n\nUsuário:\n<b>${info}</b>`, { parse_mode: 'HTML' });
    } else {
      await ctx.telegram.restrictChatMember(chatId, uId, {
        permissions: { can_send_messages: false }
      });
      await ctx.reply(`${c} <b>O Ceifador silenciou esta alma...</b>\n\nEla ultrapassou os limites.\n\nUsuário:\n<b>${info}</b>`, { parse_mode: 'HTML' });
    }

    await redis.del(key);
  }

  await sendLog(ctx, chatId, "WARN", info, formatUser(ctx.from), mot);
  return ctx.deleteMessage().catch(() => {});
}

  // =======================
// COMANDO: /unwarn (NOVO)
// =======================
if (text.startsWith("/unwarn")) {
  if (!redis) return;

  if (!target) {
    return ctx.reply(`${c} <b>Você precisa indicar uma alma.</b>`, { parse_mode: 'HTML' });
  }

  const uId = target.id;
  const key = `warns:${chatId}:${uId}`;

  let w = parseInt(await redis.get(key)) || 0;
  if (w > 0) w--;

  await redis.set(key, w);

  const info = formatUser(target);
  const limit = parseInt(await redis.get(`warn:limit:${chatId}`)) || 4;

  await ctx.reply(`${c} <b>O Ceifador removeu uma marca desta alma...</b>\n\nUsuário:\n<b>${info}</b>\nWarn atual: ${w}/${limit}`, {
    parse_mode: 'HTML'
  });

  await sendLog(ctx, chatId, "UNWARN", info, formatUser(ctx.from), "remoção de advertência");
  return ctx.deleteMessage().catch(() => {});
}

// --- [3] COMANDO: /RESETWARN (CORRIGIDO) ---
if (text.startsWith("/resetwarn")) {
  if (!redis) return;
  const pTarget = await getTarget(ctx);

  if (!pTarget) {
    return ctx.reply(`${c} <b>ERRO NAS SOMBRAS</b>\n\nNão consegui localizar esta alma. Use em resposta a alguém ou digite o ID/Username após o comando.`, { parse_mode: 'HTML' });
  }

  const uId = pTarget.id;
  await redis.del(`warns:${chatId}:${uId}`);
  const info = formatUser(pTarget);

  await ctx.reply(`${c} <b>ALMA PURIFICADA!</b>\n\nUsuário:\n<b>${info}</b>\nTodas as marcas foram removidas do registro.`, { parse_mode: 'HTML' });
  await sendLog(ctx, chatId, "RESETWARN", info, formatUser(ctx.from), "reset de advertências");
  return ctx.deleteMessage().catch(() => {});
}

  // DEL
  if (reply && text.startsWith("/del")) {
    await ctx.telegram.deleteMessage(chatId, reply.message_id).catch(() => {});
    return ctx.deleteMessage().catch(() => {});
  }

// ======================================
// --- OBLITERAÇÃO DO SUBMUNDO (FINAL) ---
// ======================================

// ====================
// COMANDO: /delwarn
// ====================
if (text.startsWith("/delwarn")) {
  if (!target) {
    return ctx.reply(`${c} <b>Você precisa indicar uma alma.</b>`, { parse_mode: "HTML" });
  }

  const uId = target.id;

  try {
    await ctx.telegram.deleteMessage(chatId, ctx.message.reply_to_message?.message_id).catch(() => {});

    const key = `warns:${chatId}:${uId}`;
    let w = parseInt(await redis.get(key)) || 0;
    w++;

    await redis.set(key, w);

    const info = formatUser(target);
    const limit = parseInt(await redis.get(`warn_limit:${chatId}`)) || 4;

    await ctx.reply(`${c} <b>Marca aplicada à alma...</b>\n\nUsuário:\n<b>${info}</b>\nWarn: ${w}/${limit}`, {
      parse_mode: "HTML"
    });

    await sendLog(ctx, chatId, "DELWARN", info, formatUser(ctx.from), "delwarn");

  } catch {}

  return ctx.deleteMessage().catch(() => {});
}

// ====================
// COMANDO: /mute
// ====================
if (text.startsWith("/mute")) {
  if (!target) {
    return ctx.reply(`${c} <b>Você precisa indicar uma alma.</b>`, { parse_mode: "HTML" });
  }

  const uId = target.id;
  const info = formatUser(target);

  await ctx.telegram.restrictChatMember(chatId, uId, {
    can_send_messages: false
  }).catch(() => {});

  await ctx.reply(`${c} <b>O Ceifador silenciou esta alma...</b>\n\nUsuário:\n<b>${info}</b>`, {
    parse_mode: "HTML"
  });

  await sendLog(ctx, chatId, "MUTE", info, formatUser(ctx.from), getMotivo(text, "/mute"));

  return ctx.deleteMessage().catch(() => {});
}

// ====================
// COMANDO: /unmute
// ====================
if (text.startsWith("/unmute")) {
  if (!target) {
    return ctx.reply(`${c} <b>Você precisa indicar uma alma.</b>`, { parse_mode: "HTML" });
  }

  const uId = target.id;
  const info = formatUser(target);

  await ctx.telegram.restrictChatMember(chatId, uId, {
    can_send_messages: true
  }).catch(() => {});

  await ctx.reply(`${c} <b>O Ceifador libertou a voz desta alma...</b>\n\nUsuário:\n<b>${info}</b>`, {
    parse_mode: "HTML"
  });

  await sendLog(ctx, chatId, "UNMUTE", info, formatUser(ctx.from), "unmute");

  return ctx.deleteMessage().catch(() => {});
}

// ====================
// COMANDO: /ban
// ====================
if (text.startsWith("/ban")) {
  if (!target) {
    return ctx.reply(`${c} <b>Você precisa indicar uma alma.</b>`, { parse_mode: "HTML" });
  }

  const uId = target.id;
  const info = formatUser(target);

  await ctx.telegram.banChatMember(chatId, uId).catch(() => {});

  await ctx.reply(`${c} <b>O Ceifador baniu esta alma...</b>\n\nUsuário:\n<b>${info}</b>`, {
    parse_mode: "HTML"
  });

  await sendLog(ctx, chatId, "BAN", info, formatUser(ctx.from), getMotivo(text, "/ban"));

  return ctx.deleteMessage().catch(() => {});
}

// ====================
// COMANDO: /unban
// ====================
if (text.startsWith("/unban")) {
  if (!target) {
    return ctx.reply(`${c} <b>Você precisa indicar uma alma.</b>`, { parse_mode: "HTML" });
  }

  const uId = target.id;
  const info = formatUser(target);

  await ctx.telegram.unbanChatMember(chatId, uId).catch(() => {});

  await ctx.reply(`${c} <b>O Ceifador permitiu o retorno desta alma...</b>\n\nUsuário:\n<b>${info}</b>`, {
    parse_mode: "HTML"
  });

  await sendLog(ctx, chatId, "UNBAN", info, formatUser(ctx.from), "unban");

  return ctx.deleteMessage().catch(() => {});
}

// ====================
// COMANDO: /kick
// ====================
if (text.startsWith("/kick")) {
  if (!target) {
    return ctx.reply(`${c} <b>Você precisa indicar uma alma.</b>`, { parse_mode: "HTML" });
  }

  const uId = target.id;
  const info = formatUser(target);

  await ctx.telegram.banChatMember(chatId, uId).catch(() => {});
  await ctx.telegram.unbanChatMember(chatId, uId).catch(() => {});

  await ctx.reply(`${c} <b>O Ceifador expulsou esta alma...</b>\n\nUsuário:\n<b>${info}</b>`, {
    parse_mode: "HTML"
  });

  await sendLog(ctx, chatId, "KICK", info, formatUser(ctx.from), getMotivo(text, "/kick"));

  return ctx.deleteMessage().catch(() => {});
}
// ====================
// COMANDO: /delmute
// ====================
if (text.startsWith("/delmute")) {
  if (!target) {
    return ctx.reply(`${c} <b>Você precisa indicar uma alma.</b>`, { parse_mode: "HTML" });
  }

  const uId = target.id;

  try {
    // apaga a mensagem alvo (se for reply)
    if (ctx.message.reply_to_message) {
      await ctx.telegram.deleteMessage(chatId, ctx.message.reply_to_message.message_id).catch(() => {});
    }

    // aplica mute
    await ctx.telegram.restrictChatMember(chatId, uId, {
      can_send_messages: false
    }).catch(() => {});

    // soma warn
    const key = `warns:${chatId}:${uId}`;
    let w = parseInt(await redis.get(key)) || 0;
    w++;

    await redis.set(key, w);

    const info = formatUser(target);
    const limit = parseInt(await redis.get(`warn_limit:${chatId}`)) || 4;

    await ctx.reply(`${c} <b>Mensagem apagada e alma silenciada...</b>\n\nUsuário:\n<b>${info}</b>\nWarn: ${w}/${limit}`, {
      parse_mode: "HTML"
    });

    await sendLog(ctx, chatId, "DELMUTE", info, formatUser(ctx.from), "delmute");

  } catch {}

  return ctx.deleteMessage().catch(() => {});
}

      // --- PROMOTE (HÍBRIDO: REPLY, ID OU @) ---
  if (text.startsWith("/promote") && isAdm) {
    const pTarget = await getTarget(ctx);
    if (!pTarget) return ctx.reply(`${c} Indique uma alma por ID, @ ou Resposta.`);
    try {
      await ctx.telegram.promoteChatMember(chatId, pTarget.id, {
        can_manage_chat: true, can_delete_messages: true, can_restrict_members: true, can_invite_users: true, can_pin_messages: true
      });
      const info = formatUser(pTarget);
      await ctx.reply(`${c} <b>Alma elevada ao conselho!</b>\n\nUsuário:\n<b>${info}</b>`, { parse_mode: 'HTML' });
      await sendLog(ctx, chatId, "PROMOTE", info, formatUser(ctx.from), "promoção");
    } catch (e) { ctx.reply(`Erro: ${e.message}`); }
    return ctx.deleteMessage().catch(() => {});
  }

  // --- DEMOTE (HÍBRIDO: REPLY, ID OU @) ---
  if (text.startsWith("/demote") && isAdm) {
    const dTarget = await getTarget(ctx);
    if (!dTarget) return ctx.reply(`${c} Indique uma alma por ID, @ ou Resposta.`);
    try {
      await ctx.telegram.promoteChatMember(chatId, dTarget.id, {
        can_manage_chat: false, can_delete_messages: false, can_restrict_members: false, can_invite_users: false, can_pin_messages: false
      });
      const info = formatUser(dTarget);
      await ctx.reply(`${c} <b>Privilégios retirados do pecador.</b>\n\nUsuário:\n<b>${info}</b>`, { parse_mode: 'HTML' });
      await sendLog(ctx, chatId, "DEMOTE", info, formatUser(ctx.from), "rebaixamento");
    } catch (e) { ctx.reply(`Erro: ${e.message}`); }
    return ctx.deleteMessage().catch(() => {});
  }
});

// --- MOTOR DE BOAS-VINDAS COMPLETO (DNA + MÍDIA EMBAIXO) ---
bot.on('new_chat_members', async (ctx) => {
  if (!redis) return;
  const gId = ctx.chat.id;
  if ((await redis.get(`stat:welcome:${gId}`)) !== "on") return;
  const list = await redis.smembers(`w_list:${gId}`);
  if (!list || list.length === 0) return;

  let welcome;
  try { 
    welcome = JSON.parse(list[Math.floor(Math.random() * list.length)]); 
  } catch (e) { return; }

  const u = ctx.from;
  const now = new Date();
  const fullName = `${u.first_name || ""} ${u.last_name || ""}`.trim();
  
  const tags = {
    '{ID}': u.id, '{id}': u.id,
    '{NAME}': u.first_name || "", '{name}': u.first_name || "",
    '{FIRST}': u.first_name || "", '{first}': u.first_name || "",
    '{SURNAME}': u.last_name || "", '{surname}': u.last_name || "",
    '{NAMESURNAME}': fullName, '{namesurname}': fullName,
    '{USERNAME}': u.username ? `@${u.username}` : "n/a", '{username}': u.username ? `@${u.username}` : "n/a",
    '{MENTION}': `<a href='tg://user?id=${u.id}'><b>${u.first_name}</b></a>`, '{mention}': `<a href='tg://user?id=${u.id}'><b>${u.first_name}</b></a>`,
    '{GROUPNAME}': ctx.chat.title || "", '{groupname}': ctx.chat.title || "",
    '{DATE}': now.toLocaleDateString("pt-BR"), '{date}': now.toLocaleDateString("pt-BR"),
    '{TIME}': now.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }), '{time}': now.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
    '{WEEKDAY}': now.toLocaleDateString("pt-BR", { weekday: "long" }), '{weekday}': now.toLocaleDateString("pt-BR", { weekday: "long" })
  };

  let finalMsg = (welcome.text || "");
  let finalEntities = welcome.entities ? JSON.parse(JSON.stringify(welcome.entities)) : [];

  // RECALCULO DE DNA PARA EMOJIS PREMIUM
  Object.keys(tags).forEach(tag => {
    const replacement = String(tags[tag]);
    while (finalMsg.includes(tag)) {
      const index = finalMsg.indexOf(tag);
      const diff = replacement.length - tag.length;
      finalEntities.forEach(ent => { if (ent.offset > index) ent.offset += diff; });
      finalMsg = finalMsg.replace(tag, replacement);
    }
  });

  // LIMPEZA FINAL DAS ENTIDADES PARA O FETCH ACEITAR
  const cleanedEntities = finalEntities.map(ent => {
    const { user, ...rest } = ent; 
    return rest;
  });

  try {
    const body = {
      chat_id: gId,
      reply_markup: welcome.reply_markup || undefined,
      show_caption_above_media: true // MÍDIA EMBAIXO
    };

    let endpoint = "sendMessage";

    if (!welcome.media || welcome.type === 'text') {
      endpoint = "sendMessage"; 
      body.text = finalMsg; 
      body.entities = cleanedEntities; 
    } else {
      body.caption = finalMsg; 
      body.caption_entities = cleanedEntities;
      if (welcome.type === 'photo') { endpoint = "sendPhoto"; body.photo = welcome.media; }
      else if (welcome.type === 'video') { endpoint = "sendVideo"; body.video = welcome.media; }
      else if (welcome.type === 'animation') { endpoint = "sendAnimation"; body.animation = welcome.media; }
      else if (welcome.type === 'sticker') { endpoint = "sendSticker"; body.sticker = welcome.media; }
      else if (welcome.type === 'voice') { endpoint = "sendVoice"; body.voice = welcome.media; }
      else if (welcome.type === 'audio') { endpoint = "sendAudio"; body.audio = welcome.media; }
    }

    // ENVIO VIA API DIRETA (DNA PURO)
    await fetch(`https://api.telegram.org/bot${process.env.BOT_TOKEN}/${endpoint}`, {
      method: "POST", 
      headers: { "Content-Type": "application/json" }, 
      body: JSON.stringify(body)
    });
  } catch (e) { 
    console.log("Erro no welcome:", e.message); 
  }
});

// --- [FIM DO BLOCO: MOTOR DE BOAS-VINDAS] ---

// 🚀 LANÇAMENTO DO BOT
bot.launch()
  .then(() => console.log("O Ceifador despertou... Dimensão Fantasma Online!"))
  .catch((err) => console.error("Erro ao despertar o Ceifador:", err));

// Garantir desligamento suave
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));