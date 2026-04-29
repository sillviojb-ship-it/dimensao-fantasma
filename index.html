const { Telegraf } = require('telegraf');
const https = require('https');

// --- INICIALIZAÇÃO DO REDIS ---
let redis = null;
try {
  const Redis = require('ioredis');
  if (process.env.REDIS_URL) {
    redis = new Redis(process.env.REDIS_URL);
    redis.on("connect", () => console.log("Redis Conectado ✅"));
  }
} catch (e) { console.log("Erro Redis:", e.message); }

const bot = new Telegraf(process.env.BOT_TOKEN);
const c = "<tg-emoji emoji-id='4916220696025106096'>💀</tg-emoji>";

// --- VERIFICAÇÃO DE ADMIN ---
const isAdmin = async (ctx) => {
  try {
    const m = await ctx.telegram.getChatMember(ctx.chat.id, ctx.from.id);
    return ["creator", "administrator"].includes(m.status);
  } catch { return false; }
};

// --- MOTOR DE ENVIO DIRETO (O SEGREDO DA MÍDIA EMBAIXO) ---
const sendDirect = async (chatId, method, payload) => {
  const data = JSON.stringify({ 
    chat_id: chatId, 
    ...payload, 
    show_caption_above_media: true,
    expand_media_caption: true 
  });

  const options = {
    hostname: 'api.telegram.org',
    port: 443,
    path: `/bot${process.env.BOT_TOKEN}/${method}`,
    method: 'POST',
    headers: { 
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(data)
    }
  };

  const req = https.request(options, (res) => {
    res.on('data', () => {}); // Consome a resposta
  });
  req.on('error', (e) => console.error("Erro no envio direto:", e));
  req.write(data);
  req.end();
};

// --- COMANDO /SAY (MANIFESTAÇÃO DO CEIFADOR) ---
bot.on(['text', 'caption', 'photo', 'video', 'animation'], async (ctx) => {
  const m = ctx.message;
  if (!m || m.from?.is_bot) return;

  const txt = m.text || m.caption || "";

  if (txt.startsWith("/say") && (await isAdmin(ctx))) {
    const space = txt.indexOf(' ');
    const clean = txt.slice(space === -1 ? txt.length : space + 1);
    
    // Tags Dinâmicas
    const u = m.reply_to_message ? m.reply_to_message.from : m.from;
    let fTxt = clean.replace(/{ID}/g, u.id).replace(/{NAME}/g, u.first_name);
    
    // Preparação dos Botões (DNA Brutus/Rose)
    let btns = [];
    const lines = fTxt.split('\n');
    lines.forEach(l => {
      let row = [];
      const reg = /\{\[(?:#(.) )?(.*?) - (.*?)\]\}/g;
      let match;
      while ((match = reg.exec(l)) !== null) {
        row.push({ text: match[2].trim(), url: match[3].trim() });
      }
      if (row.length) btns.push(row);
    });

    // Limpa o texto das chaves de botões
    const finalTxt = fTxt.replace(/\{\[(.*?)\]\}/g, "").trim();

    let method = "sendMessage";
    let payload = { 
      text: finalTxt, 
      parse_mode: 'HTML', 
      entities: m.entities || m.caption_entities,
      reply_markup: btns.length ? { inline_keyboard: btns } : undefined
    };

    if (m.photo) {
      method = "sendPhoto";
      payload = { photo: m.photo[m.photo.length - 1].file_id, caption: finalTxt, caption_entities: payload.entities };
    } else if (m.video || m.animation) {
      method = m.video ? "sendVideo" : "sendAnimation";
      payload = { [m.video ? "video" : "animation"]: (m.video || m.animation).file_id, caption: finalTxt, caption_entities: payload.entities };
    }

    await sendDirect(ctx.chat.id, method, payload);
    await ctx.deleteMessage().catch(() => {});
  }
});

// START
bot.command('start', (ctx) => {
    ctx.reply(`${c} <b>CEIFADOR FANTASMA 2 ATIVADO!</b>\n\nPronto para governar o território.`, { parse_mode: 'HTML' });
});

bot.launch().then(() => console.log("O Ceifador despertou no Railway!"));
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
