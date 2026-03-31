require('dotenv').config();

const axios = require('axios');

function escapeTelegramMarkdown(text) {
  return String(text || '').replace(/([_*[\]()~`>#+\-=|{}.!\\])/g, '\\$1');
}

async function sendTelegramNotification(internships = []) {
  try {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = process.env.TELEGRAM_CHAT_ID;

    if (!token || !chatId) {
      console.log('[notifier] Telegram credentials not configured. Skipping notification.');
      return;
    }

    if (!Array.isArray(internships) || internships.length === 0) {
      console.log('[notifier] No internships available for notification.');
      return;
    }

    const topInternships = [...internships]
      .sort((first, second) => Number(second.score || 0) - Number(first.score || 0))
      .slice(0, 3);

    const text = topInternships
      .map((internship) => {
        return [
          `🎯 *${escapeTelegramMarkdown(internship.title)}*`,
          `🏢 ${escapeTelegramMarkdown(internship.company)}`,
          `💰 ${escapeTelegramMarkdown(internship.stipend)}`,
          `📍 ${escapeTelegramMarkdown(internship.location)}`,
          `Score: ${Number(internship.score || 0)}/100`,
          `🔗 ${escapeTelegramMarkdown(internship.link)}`
        ].join('\n');
      })
      .join('\n\n');

    console.log(`[notifier] Sending Telegram notification for ${topInternships.length} internships.`);
    await axios.post(`https://api.telegram.org/bot${token}/sendMessage`, {
      chat_id: chatId,
      text,
      parse_mode: 'MarkdownV2',
      disable_web_page_preview: false
    }, {
      timeout: 15000
    });
    console.log('[notifier] Telegram notification sent successfully.');
  } catch (error) {
    const details = error.response ? JSON.stringify(error.response.data) : error.message;
    console.error('[notifier] Failed to send Telegram notification:', details);
  }
}

module.exports = {
  sendTelegramNotification
};
