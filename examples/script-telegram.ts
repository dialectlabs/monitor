import { Context, Telegraf } from 'telegraf';

async function run() { 
  let tgBot = new Telegraf(process.env.TELEGRAM_BOT_KEY!);
  await tgBot.start(async (ctx) => console.log({ctx}));
  await tgBot.launch();
  tgBot.telegram.sendMessage(process.env.TELEGRAM_TEST_CHAT_ID!, "Say hello to the future of web3 messaging!");
  console.log({telegraf: tgBot});
}

run();