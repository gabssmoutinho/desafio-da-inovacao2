const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;

app.use(express.static("public"));

const rooms = new Map();

const perguntas = [
  {
    pergunta: "O que é inovação?",
    alternativas: [
      "Criar ou melhorar algo de forma útil",
      "Fazer sempre exatamente a mesma coisa",
      "Evitar qualquer mudança",
      "Copiar tudo sem modificar"
    ],
        correta: 0
  },

  {
    pergunta: "Uma empresa percebe que seu produto tem boas vendas, mas está perdendo clientes para concorrentes que oferecem soluções digitais. Antes de simplesmente criar um aplicativo, a equipe decide investigar os hábitos dos clientes, identificar quais problemas ainda não são atendidos e testar pequenas soluções com um grupo de usuários. Qual conceito melhor representa essa abordagem?",
    alternativas: [
      "Inovação baseada em cópia, pois a empresa deve reproduzir as soluções digitais dos concorrentes.",
      "Inovação orientada por evidências, utilizando pesquisa, experimentação e feedback dos usuários para desenvolver uma solução.",
      "Inovação incremental, pois qualquer alteração em um produto pode ser considerada inovação incremental.",
      "Resistência à mudança, pois a empresa está evitando lançar imediatamente uma nova tecnologia."
    ],
    correta: 1,
    tempo: 30
  }
    
];

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

io.on("connection", (socket) => {

  console.log("Jogador conectado:", socket.id);


  // CRIAR PARTIDA
  socket.on("criar-partida", ({ nome }) => {

    const codigo = gerarCodigo();

    const jogador = {
      id: socket.id,
      nome: nome || "Professor",
      host: true,
      pontos: 0
    };

    rooms.set(codigo, {
      codigo: codigo,
      hostId: socket.id,
      jogadores: [jogador],
      status: "aguardando",
      perguntaAtual: 0,
      inicioPergunta: null,
      respostas: new Map()
    });

    socket.join(codigo);

    socket.emit("partida-criada", {
      codigo: codigo,
      jogadores: [jogador]
    });

    console.log("Partida criada:", codigo);
  });


  // ENTRAR NA PARTIDA
  socket.on("entrar-partida", ({ codigo, nome }) => {

    codigo = String(codigo || "").trim().toUpperCase();

    const sala = rooms.get(codigo);

    if (!sala) {
      socket.emit(
        "erro-partida",
        "Partida não encontrada."
      );
      return;
    }

    if (sala.status !== "aguardando") {
      socket.emit(
        "erro-partida",
        "Essa partida já começou."
      );
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

    io.to(codigo).emit(
      "jogadores-atualizados",
      {
        jogadores: sala.jogadores
      }
    );

    socket.emit(
      "entrou-partida",
      {
        codigo: codigo,
        jogadores: sala.jogadores
      }
    );

    console.log(
      jogador.nome,
      "entrou na partida",
      codigo
    );
  });


  // INICIAR PARTIDA
  socket.on("iniciar-partida", ({ codigo }) => {

    codigo = String(codigo || "").trim().toUpperCase();

    const sala = rooms.get(codigo);

    if (!sala) {
      socket.emit(
        "erro-partida",
        "Partida não encontrada."
      );
      return;
    }

    if (sala.hostId !== socket.id) {
      socket.emit(
        "erro-partida",
        "Apenas o professor pode iniciar a partida."
      );
      return;
    }

    sala.status = "jogando";
    sala.perguntaAtual = 0;
    sala.inicioPergunta = Date.now();
    sala.tempoPergunta = perguntas[sala.perguntaAtual].tempo || 15;
    sala.respostas = new Map();

    io.to(codigo).emit(
      "partida-iniciada",
      {
  pergunta: 1,
  tempo: sala.tempoPergunta
      }
    );

    console.log(
      "Partida iniciada:",
      codigo
    );
  });


  // RESPONDER PERGUNTA
  socket.on("responder-pergunta", ({ codigo, resposta }) => {

    codigo = String(codigo || "").trim().toUpperCase();

    const sala = rooms.get(codigo);

    if (!sala) {
      socket.emit(
        "erro-partida",
        "Partida não encontrada."
      );
      return;
    }

    if (sala.status !== "jogando") {
      return;
    }

    // Impede responder duas vezes
    if (sala.respostas.has(socket.id)) {
      return;
    }

    const jogador = sala.jogadores.find(
      (j) => j.id === socket.id
    );

    if (!jogador) {
      return;
    }

    const pergunta = perguntas[sala.perguntaAtual];

    const respostaEscolhida = Number(resposta);

    const acertou =
      respostaEscolhida === pergunta.correta;

    // Calcula o tempo utilizado
    const tempo =
      (Date.now() - sala.inicioPergunta) / 1000;

    let pontos = 0;

    if (acertou) {

      // Quanto mais rápido, maior a pontuação
      pontos = Math.max(
        500,
        Math.round(1000 - tempo * 40)
      );

      jogador.pontos += pontos;
    }

    sala.respostas.set(socket.id, {
      resposta: respostaEscolhida,
      acertou: acertou,
      pontos: pontos
    });

    socket.emit(
      "resultado-resposta",
      {
        acertou: acertou,
        pontos: pontos,
        total: jogador.pontos
      }
    );

    console.log(
      jogador.nome,
      "respondeu:",
      respostaEscolhida,
      "Acertou:",
      acertou,
      "Pontos:",
      pontos
    );

    // Envia a pontuação atualizada para todos
    io.to(codigo).emit(
      "pontuacao-atualizada",
      {
        jogadores: sala.jogadores
      }
    );
        const jogadoresRespondendo =
      sala.jogadores.filter((j) => !j.host);

    const todosResponderam =
      jogadoresRespondendo.length > 0 &&
      jogadoresRespondendo.every((j) =>
        sala.respostas.has(j.id)
      );

    if (todosResponderam) {

      if (sala.perguntaAtual < perguntas.length - 1) {

        sala.perguntaAtual++;
        sala.inicioPergunta = Date.now();
        sala.tempoPergunta =
          perguntas[sala.perguntaAtual].tempo || 15;
        sala.respostas = new Map();

        io.to(codigo).emit(
          "nova-pergunta",
          {
            pergunta: sala.perguntaAtual + 1,
            dados: perguntas[sala.perguntaAtual],
            tempo: sala.tempoPergunta
          }
        );

      }

    }
  });


  // DESCONEXÃO
  socket.on("disconnect", () => {

    console.log(
      "Jogador desconectado:",
      socket.id
    );

    for (const [codigo, sala] of rooms.entries()) {

      const jogador = sala.jogadores.find(
        (j) => j.id === socket.id
      );

      if (!jogador) {
        continue;
      }

      sala.jogadores =
        sala.jogadores.filter(
          (j) => j.id !== socket.id
        );

      // Se o professor sair, encerra a sala
      if (sala.hostId === socket.id) {

        io.to(codigo).emit(
          "erro-partida",
          "O professor saiu da partida."
        );

        rooms.delete(codigo);

        break;
      }

      io.to(codigo).emit(
        "jogadores-atualizados",
        {
          jogadores: sala.jogadores
        }
      );

      break;
    }
  });

});


server.listen(PORT, () => {

  console.log(
    "Servidor rodando na porta",
    PORT
  );

});
