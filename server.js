const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;

// Permite que o servidor entregue os arquivos do jogo
app.use(express.static("public"));

// Salas atualmente abertas
const rooms = new Map();

// Gera um código de 6 caracteres
function gerarCodigo() {
  const caracteres = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

  let codigo;

  do {
    codigo = "";

    for (let i = 0; i < 6; i++) {
      codigo += caracteres[
        Math.floor(Math.random() * caracteres.length)
      ];
    }
  } while (rooms.has(codigo));

  return codigo;
}

// Conexão de um jogador
io.on("connection", (socket) => {
  console.log("Jogador conectado:", socket.id);

  // Criar uma partida
  socket.on("criar-partida", ({ nome }) => {
    const codigo = gerarCodigo();

    const jogador = {
      id: socket.id,
      nome: nome || "Professor",
      host: true,
      pontos: 0
    };

    rooms.set(codigo, {
      codigo,
      hostId: socket.id,
      jogadores: [jogador],
      status: "aguardando",
      perguntaAtual: 0
    });

    socket.join(codigo);

    socket.emit("partida-criada", {
      codigo,
      jogadores: [jogador]
    });

    console.log(`Partida criada: ${codigo}`);
  });

  // Entrar em uma partida
  socket.on("entrar-partida", ({ codigo, nome }) => {
    codigo = String(codigo || "").trim().toUpperCase();

    const sala = rooms.get(codigo);

    if (!sala) {
      socket.emit("erro-partida", "Partida não encontrada.");
      return;
    }

    if (sala.status !== "aguardando") {
      socket.emit("erro-partida", "Essa partida já começou.");
      return;
    }

    const jogador = {
      id: socket.id,
      nome: nome || "Jogador",
      host: false,
      pontos: 0
    };

    sala.jogadores.push(jogador);

    socket.join(codigo);

    io.to(codigo).emit("jogadores-atualizados", {
      jogadores: sala.jogadores
    });

    socket.emit("entrou-partida", {
      codigo,
      jogadores: sala.jogadores
    });

    console.log(`${jogador.nome} entrou na partida ${codigo}`);
  });

  // Desconexão
  socket.on("disconnect", () => {
    console.log("Jogador desconectado:", socket.id);

    for (const [codigo, sala] of rooms.entries()) {
      const jogador = sala.jogadores.find(
        (j) => j.id === socket.id
      );

      if (jogador) {
        sala.jogadores = sala.jogadores.filter(
          (j) => j.id !== socket.id
        );

        io.to(codigo).emit("jogadores-atualizados", {
          jogadores: sala.jogadores
        });

        break;
      }
    }
  });
});

// Inicia o servidor
server.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});
