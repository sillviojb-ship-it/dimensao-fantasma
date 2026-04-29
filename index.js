const { Telegraf } = require('telegraf');

// O Token vem das variáveis do Railway
const bot = new Telegraf(process.env.BOT_TOKEN);

console.log("Iniciando limpeza de Webhook...");

// Essa linha limpa qualquer rastro da Cloudflare automaticamente
bot.telegram.deleteWebhook().then(() => {
    console.log("Caminho limpo! O Ceifador assumiu o Railway.");
    
    bot.start((ctx) => {
        ctx.reply("💀 CEIFADOR FANTASMA 2 ATIVADO!\n\nAgora rodando 100% pelo Railway.");
    });

    bot.command('say', async (ctx) => {
        const msg = ctx.message.text || ctx.message.caption || "";
        const textToSend = msg.replace('/say', '').trim();

        if (ctx.message.reply_to_message && ctx.message.reply_to_message.photo) {
            const photo = ctx.message.reply_to_message.photo.pop().file_id;
            try {
                await ctx.deleteMessage();
                await ctx.reply(textToSend, { parse_mode: 'HTML' });
                await ctx.replyWithPhoto(photo);
            } catch (e) {
                console.error("Erro no comando say:", e);
            }
        } else {
            ctx.reply("Responda a uma foto com /say para inverter a ordem.");
        }
    });

    bot.launch().then(() => {
        console.log("O Ceifador despertou no Railway!");
    });
});

// Tratamento de erros para o bot não cair
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
