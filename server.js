import "dotenv/config";
import express from "express";
import cors from "cors";
import { Client, GatewayIntentBits } from "discord.js";

const app = express();
app.use(cors());

// Admin role IDs (dopíš svoje ID)
const ADMIN_ROLES = [
  "1145441979870740590"  //Admin
];

// Discord klient
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildPresences
  ]
});

// Cache členov
let voiceMembers = [];

// Pomocná funkcia – pridali sme roles
function formatMember(member) {
  return {
    id: member.user.id,
    name: member.displayName,
    avatar: member.user.displayAvatarURL({ size: 64 }),
    status: member.presence?.status || "offline",
    channelName: member.voice.channel?.name || null,
    roles: member.roles.cache.map(r => r.id) // ← pridali sme role
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

  // Prejsť všetkých členov v hlasových kanáloch
  guild.voiceStates.cache.forEach(vs => {
    const member = vs.member;
    const status = member.presence?.status || "offline";

    // Invisible/offline → skryť
    if (!vs.channelId) return;
    if (status === "offline") return;
    if (status === "invisible") return;

    newList.push(formatMember(member));
  });

  // Zoradenie – admini hore
  voiceMembers = newList.sort((a, b) => {
    const aIsAdmin = a.roles && a.roles.some(r => ADMIN_ROLES.includes(r));
    const bIsAdmin = b.roles && b.roles.some(r => ADMIN_ROLES.includes(r));

    if (aIsAdmin && !bIsAdmin) return -1;
    if (!aIsAdmin && bIsAdmin) return 1;

    return (a.name || "").localeCompare(b.name || "");
  });
}

// Keď sa bot prihlási
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
