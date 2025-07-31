
const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require("@whiskeysockets/baileys");
const { Boom } = require("@hapi/boom");
const express = require("express");
const fs = require("fs");

const app = express();
app.use(express.json());

async function startSock() {
  const { state, saveCreds } = await useMultiFileAuthState("auth");

  const sock = makeWASocket({
    auth: state,
    printQRInTerminal: true,
  });

  sock.ev.on("creds.update", saveCreds);

  const { generateWAMessageFromContent, proto } = require("@whiskeysockets/baileys");
  const qrcode = require("qrcode-terminal");
  
  sock.ev.on("connection.update", (update) => {
    const { connection, lastDisconnect, qr } = update;
  
    if (qr) {
      qrcode.generate(qr, { small: true });
    }
  
    if (connection === "close") {
      const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
      console.log("🔁 Conexión cerrada");
      if (shouldReconnect) {
        startSock();
      }
    } else if (connection === "open") {
      console.log("✅ Conectado a WhatsApp");
    }
  });

  sock.ev.on("messages.upsert", async ({ messages, type }) => {
    const msg = messages[0];
    const remoteJid = msg.key.remoteJid;

    if (remoteJid.endsWith("@g.us")) {
      console.log("🧾 ID del grupo:", remoteJid);
    }
  });
  

  // Endpoint para enviar imagen a grupo
  app.post("/send-to-group", async (req, res) => {
    const { groupId, imageUrl, caption } = req.body;
    try {
      await sock.sendMessage(groupId, {
        image: { url: imageUrl },
        caption,
      });
      res.send({ success: true });
    } catch (err) {
      console.error("❌ Error al enviar mensaje:", err);
      res.status(500).send({ error: err.message });
    }
  });

  // Endpoint para publicar múltiples imágenes
  app.post('/publicar', async (req, res) => {
    try {
      let { grupoid, mensaje, imagenes } = req.body;

      // Si imagenes viene como string, convertir a array
      if (typeof imagenes === "string") {
        imagenes = [imagenes];
      } else if (!imagenes || !Array.isArray(imagenes)) {
        imagenes = [];
      }

      // Sanitizar imagenes: remover URLs vacías o con solo espacios
      imagenes = imagenes.filter(i => i && i.trim() !== "");

      console.log("📩 Recibido:", { grupoid, mensaje, imagenes });

      // Validar datos básicos
      if (!grupoid || !mensaje) {
        return res.status(400).json({ error: "Falta grupoid o mensaje" });
      }

      if (imagenes.length > 0) {
        for (const url of imagenes) {
          if (url && url.trim() !== "") {
            await sock.sendMessage(grupoid, {
              image: { url },
              caption: mensaje,
            });
          }
        }
      }
      if (imagenes.length === 0 || imagenes.every(i => !i.trim())) {
        await sock.sendMessage(grupoid, { text: mensaje });
      }

      res.status(200).json({ ok: true });
    } catch (error) {
      console.error("❌ Error en /publicar:", error);
      res.status(500).json({ error: "Error interno del servidor" });
    }
  });
}

startSock();

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Servidor Express corriendo en puerto ${PORT}`);
});
