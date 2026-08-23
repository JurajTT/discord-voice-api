import "dotenv/config";
import express from "express";
import cors from "cors";
import { Client, GatewayIntentBits } from "discord.js";

const app = express();
app.use(cors());

// Admin role IDs
const ADMIN_ROLES = [
  "1145441979870740590" // Admin
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

let voiceMembers = [];

// Formátovanie člena
function formatMember(member, voiceState) {
  return {
    id: member.user.id,
    name: member.displayName,
    avatar: member.user.displayAvatarURL({ size: 64 }),
    status: member.presence?.status || "offline",
    channelName: member.voice.channel?.name || null,
    roles: member.roles.cache.map(r => r.id),

    // STREAM (Go Live)
    isStreaming: voiceState.streaming || false,

    // KAMERA
    isVideo: voiceState.selfVideo || false,

    // MUTE / DEAF
    selfMute: voiceState.selfMute,
    selfDeaf: voiceState.selfDeaf,
    serverMute: voiceState.serverMute,
    serverDeaf: voiceState.serverDeaf
  };
}

// Refresh každé 2 sekundy
async function refreshVoiceMembers() {
  const guild = client.guilds.cache.get(process.env.GUILD_ID);
  if (!guild) return;

  const newList = [];

  const allVoiceChannels = guild.channels.cache
    .filter(ch => ch.type === 2)
    .map(ch => ch.name);

  for (const [_, vs] of guild.voiceStates.cache) {
    const member = vs.member;
    const status = member.presence?.status || "offline";

    if (!vs.channelId) continue;
    if (status === "offline") continue;
    if (status === "invisible") continue;

    const fullMember = await guild.members.fetch(member.id).catch(() => null);
    if (!fullMember) continue;

    newList.push(formatMember(fullMember, vs));
  }

  // Admini hore
  voiceMembers = newList.sort((a, b) => {
    const aIsAdmin = a.roles.some(r => ADMIN_ROLES.includes(r));
    const bIsAdmin = b.roles.some(r => ADMIN_ROLES.includes(r));

    if (aIsAdmin && !bIsAdmin) return -1;
    if (!aIsAdmin && bIsAdmin) return 1;

    return (a.name || "").localeCompare(b.name || "");
  });

  // Prázdne kanály
  allVoiceChannels.forEach(channelName => {
    const exists = newList.some(m => m.channelName === channelName);
    if (!exists) {
      voiceMembers.push({
        id: null,
        name: null,
        avatar: null,
        status: null,
        channelName
      });
    }
  });
}

client.on("ready", () => {
  console.log(`Bot prihlásený ako ${client.user.tag}`);
  setInterval(refreshVoiceMembers, 2000);
});

// API endpoint
app.get("/members", (req, res) => {
  res.json(voiceMembers);
});

// Spustenie API
app.listen(process.env.PORT || 3000, () => {
  console.log("API beží na porte 3000");
});

// PRIHLÁSENIE BOTA
client.login(process.env.DISCORD_TOKEN);
