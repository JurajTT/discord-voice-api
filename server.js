import "dotenv/config";
import express from "express";
import cors from "cors";
import { Client, GatewayIntentBits } from "discord.js";

const app = express();
app.use(cors());

// Discord klient
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildPresences
  ]
});

// Cache èlenov
let voiceMembers = [];

// Pomocná funkcia
function formatMember(member) {
  return {
    id: member.user.id,
    name: member.displayName, // menovka namiesto username
    avatar: member.user.displayAvatarURL({ size: 64 }),
    status: member.presence?.status || "offline",
    channelName: member.voice.channel?.name || null
  };
}

// Funkcia na aktualizáciu zoznamu každé 2 sekundy
async function refreshVoiceMembers() {
  const guild = client.guilds.cache.get(process.env.GUILD_ID);
  if (!guild) return;

  const newList = [];

  // Zoznam všetkých hlasových kanálov
  const allVoiceChannels = guild.channels.cache
    .filter(ch => ch.type === 2) // 2 = GUILD_VOICE
    .map(ch => ch.name);

  // Prejs všetkých èlenov v hlasových kanáloch
  guild.voiceStates.cache.forEach(vs => {
    const member = vs.member;
    const status = member.presence?.status || "offline";

    // Invisible/offline › skry
    if (!vs.channelId) return;
    if (status === "offline") return;
    if (status === "invisible") return;

    newList.push(formatMember(member));
  });

  // Prida prázdne kanály
  allVoiceChannels.forEach(channelName => {
    const exists = newList.some(m => m.channelName === channelName);
    if (!exists) {
      newList.push({
        id: null,
        name: null,
        avatar: null,
        status: null,
        channelName
      });
    }
  });

  voiceMembers = newList;
}

// Keï sa bot prihlási
client.on("ready", async () => {
  console.log(`Bot prihlásený ako ${client.user.tag}`);

  // Spusti automatickú kontrolu každé 2 sekundy
  setInterval(refreshVoiceMembers, 2000);
});

// API endpoint
app.get("/members", (req, res) => {
  res.json(voiceMembers);
});

// Spustenie API
app.listen(3000, () => {
  console.log("API beží na porte 3000");
});

// Prihlásenie bota
client.login(process.env.BOT_TOKEN);
