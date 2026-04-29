const { Telegraf } = require('telegraf');

const bot = new Telegraf(process.env.BOT_TOKEN);

// Mensagem de Start com o Ceifadorzinho
bot.start((ctx) => {
    ctx.reply("PROJETO DIMENSÃO FANTASMA 💀\n\nCeifador Fantasma 2 Ativado!\n\nEnvie uma mídia com /say para formatar com o estilo oficial.");
});

bot.command('say', async (ctx) => {
    // Pega o texto e as entidades (emojis, links, negrito)
    const text = ctx.message.text || ctx.message.caption || "";
    const entities = ctx.message.entities || ctx.message.caption_entities || [];

    if (!text.includes(' ')) return ctx.reply("Diga algo após o comando.");

    // Remove o '/say ' do texto e ajusta as entidades
    const newText = text.replace(/^\/say\s*/, "");
    const offsetAdjustment = text.length - newText.length;

    const newEntities = entities
        .map(e => ({ ...e, offset: e.offset - offsetAdjustment }))
        .filter(e => e.offset >= 0);

    // Se for resposta a uma foto
    if (ctx.message.reply_to_message && ctx.message.reply_to_message.photo) {
        const photo = ctx.message.reply_to_message.photo.pop().file_id;
        
        try {
            await ctx.deleteMessage();
            // Primeiro o Texto com as entidades preservadas (DNA do Emoji)
            await ctx.reply(newText, { entities: newEntities });
            // Depois a Foto embaixo
            await ctx.replyWithPhoto(photo);
        } catch (e) {
            console.error("Erro no comando:", e);
        }
    } else {
        ctx.reply("Responda a uma foto com /say para usar o formato oficial.");
    }
});

bot.launch().then(() => console.log("O Ceifador despertou no Railway!"));

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
