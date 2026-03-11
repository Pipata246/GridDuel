export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(200).json({ ok: true });
    return;
  }

  const token = process.env.TELEGRAM_BOT_TOKEN;

  if (!token) {
    console.error('TELEGRAM_BOT_TOKEN is not set');
    res.status(500).json({ ok: false, error: 'Bot token is not configured' });
    return;
  }

  const update = req.body;

  try {
    const message = update?.message;
    const chatId = message?.chat?.id;
    const text = message?.text;

    if (!chatId) {
      res.status(200).json({ ok: true });
      return;
    }

    if (text === '/start') {
      const replyText =
        'Это приложение с играми на звезды.\n\n' +
        'Здесь будут:\n' +
        '— разные режимы игр;\n' +
        '— онлайн-игры с другими игроками;\n' +
        '— игры против бота.\n\n' +
        'Нажми кнопку ниже, чтобы открыть приложение.';

      // WebApp лежит в корне проекта и доступен по /app.html
      const webAppUrl = 'https://grid-duel.vercel.app/app.html';

      await sendMessage(token, chatId, replyText, {
        reply_markup: {
          inline_keyboard: [
            [
              {
                text: 'Открыть приложение',
                web_app: {
                  url: webAppUrl
                }
              }
            ]
          ]
        }
      });
    }

    res.status(200).json({ ok: true });
  } catch (error) {
    console.error('Error handling update', error);
    res.status(500).json({ ok: false });
  }
}

async function sendMessage(token, chatId, text, extraPayload = {}) {
  const url = `https://api.telegram.org/bot${token}/sendMessage`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: 'HTML',
      ...extraPayload
    })
  });

  if (!response.ok) {
    const data = await response.text();
    console.error('Error from Telegram API:', data);
  }
}

