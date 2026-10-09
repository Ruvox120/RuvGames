const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const fs = require("fs");

const dictionnaire = JSON.parse(
    fs.readFileSync("./dictionnaire.json", "utf8")
);

const blindtestDB = JSON.parse(
    fs.readFileSync("./blindtest_db.json", "utf8")
);

const gamepixelDB = JSON.parse(
    fs.readFileSync("./gamepixel_db.json", "utf8")
);

const syllabes = [
    "on",
    "ou",
    "ai",
    "en",
    "er",
    "an",
    "re",
    "am"
];

let bombe = {
    joueurs: [],
    indexJoueurActuel: 0,
    syllabeActuelle: null,
    listeMotsUtilises: [],
    tempsRestant: 30,
    chronoInterval: null
};

let blindtest = {
    morceauActuel: null,
    enCours: false
};

let gamepixel = {
    imageActuelle: null,
    enCours: false,
    debutManche: null
};

function lancerNouvelleImage() {
    gamepixel.enCours = true;
    gamepixel.debutManche = Date.now();

    const index = Math.floor(
        Math.random() * gamepixelDB.length
    );

    gamepixel.imageActuelle = gamepixelDB[index];

    console.log(
        "Nouvelle image Game Pixel :",
        gamepixel.imageActuelle.fichier
    );

    io.to("gamepixel").emit(
        "gamepixel-nouvelle-image",
        gamepixel.imageActuelle.fichier
    );
}

function lancerNouveauMorceau() {
    blindtest.enCours = true;

    const index = Math.floor(
        Math.random() * blindtestDB.length
    );

    blindtest.morceauActuel = blindtestDB[index];

    io.to("blindtest").emit(
        "blindtest-nouveau-morceau",
        blindtest.morceauActuel.fichier
    );
}

function nouvelleMancheBombe() {
    const index = Math.floor(Math.random() * syllabes.length);

    bombe.syllabeActuelle = syllabes[index];

    return bombe.syllabeActuelle;
}

function demarrerChronoBombe() {
    clearInterval(bombe.chronoInterval);

    bombe.tempsRestant = 30;

    io.to("bombe").emit(
        "bombe-tick-temps",
        bombe.tempsRestant
    );

    bombe.chronoInterval = setInterval(() => {
        bombe.tempsRestant--;

        io.to("bombe").emit(
            "bombe-tick-temps",
            bombe.tempsRestant
        );

        if (bombe.tempsRestant <= 0) {
            clearInterval(bombe.chronoInterval);
            bombe.chronoInterval = null;

            const perdant =
                bombe.joueurs[bombe.indexJoueurActuel];

            io.to("bombe").emit("bombe-explosion", {
                perdant: perdant
            });

            setTimeout(() => {
                if (bombe.joueurs.length === 0) {
                    return;
                }

                bombe.listeMotsUtilises = [];

                bombe.indexJoueurActuel =
                    (bombe.indexJoueurActuel + 1) %
                    bombe.joueurs.length;

                const syllabe = nouvelleMancheBombe();

                io.to("bombe").emit("bombe-nouveau-round", {
                    syllabe: syllabe,
                    joueurActuel:
                        bombe.joueurs[bombe.indexJoueurActuel],
                    listeMotsUtilises:
                        bombe.listeMotsUtilises
                });

                if (bombe.joueurs.length >= 2) {
                    demarrerChronoBombe();
                }
            }, 3000);
        }
    }, 1000);
}

function reinitialiserBombe() {
    clearInterval(bombe.chronoInterval);

    bombe.chronoInterval = null;
    bombe.joueurs = [];
    bombe.indexJoueurActuel = 0;
    bombe.syllabeActuelle = null;
    bombe.listeMotsUtilises = [];
    bombe.tempsRestant = 30;
}

let scores = {};

function calculerPoints(temps, duree) {
    if (temps >= duree) {
        return 0;
    }

    const ratio = 1 - (temps / duree);

    return Math.floor(25 * ratio);
}

function ajouterPoints(joueur, points) {
    if (!scores[joueur]) {
        scores[joueur] = 0;
    }

    scores[joueur] += points;
}

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = 3000;

function checkWinner(board) {
    const winningCombinations = [
        [0, 1, 2],
        [3, 4, 5],
        [6, 7, 8],

        [0, 3, 6],
        [1, 4, 7],
        [2, 5, 8],

        [0, 4, 8],
        [2, 4, 6]
    ];

    for (const combination of winningCombinations) {
        const [a, b, c] = combination;

        if (
            board[a] !== null &&
            board[a] === board[b] &&
            board[a] === board[c]
        ) {
            return board[a];
        }
    }

    if (board.every((cell) => cell !== null)) {
        return "DRAW";
    }

    return null;
}

function resetGame(game) {
    game.board = Array(9).fill(null);

    game.players.X = null;
    game.players.O = null;

    game.currentPlayer = "X";
    game.gameOver = false;

    console.log(`La partie ${game.id} est réinitialisée.`);
}

app.use(express.static("public"));

const games = {
    "TICTACTOE-001": {
        id: "TICTACTOE-001",
        password: null,
        board: Array(9).fill(null),
        players: {
            X: null,
            O: null
        },
        currentPlayer: "X",
        gameOver: false
    },

    "TICTACTOE-002": {
        id: "TICTACTOE-002",
        password: null,
        board: Array(9).fill(null),
        players: {
            X: null,
            O: null
        },
        currentPlayer: "X",
        gameOver: false
    }
};

io.on("connection", (socket) => {
    console.log("Un joueur vient de se connecter :", socket.id);

    socket.on("join-tictactoe", ({ gameId, password }) => {
        console.log(
            `${socket.id} demande à rejoindre la partie ${gameId}`
        );

        if (!games[gameId]) {
            socket.emit(
                "tictactoe-error",
                "Cette partie n'existe pas."
            );
            return;
        }

        const game = games[gameId];

        if (password !== game.password) {
            socket.emit(
                "tictactoe-error",
                "Mot de passe incorrect."
            );
            return;
        }

        let symbol = null;

        if (game.players.X === null) {
            game.players.X = socket.id;
            symbol = "X";
        } else if (game.players.O === null) {
            game.players.O = socket.id;
            symbol = "O";
        }

        socket.join(gameId);
        socket.emit("tictactoe-role", symbol);
    });

    socket.on("tictactoe-move", ({ gameId, index }) => {
        const game = games[gameId];

        if (!game) {
            console.log("Partie inexistante.");
            return;
        }

        if (game.gameOver) {
            console.log(
                "Coup refusé : la partie est déjà terminée."
            );
            return;
        }

        let symbol = null;

        if (game.players.X === socket.id) {
            symbol = "X";
        } else if (game.players.O === socket.id) {
            symbol = "O";
        }

        if (symbol === null) {
            console.log(
                "Ce joueur ne fait pas partie de cette partie."
            );
            return;
        }

        if (symbol !== game.currentPlayer) {
            console.log(
                `Coup refusé : c'est au joueur ${game.currentPlayer} de jouer.`
            );
            return;
        }

        if (game.board[index] !== null) {
            console.log(
                "Coup refusé : cette case est déjà occupée."
            );
            return;
        }

        game.board[index] = symbol;

        const result = checkWinner(game.board);

        if (result === "X" || result === "O") {
            game.gameOver = true;

            console.log(`Le joueur ${result} a gagné !`);

            io.to(gameId).emit("tictactoe-game-over", {
                result: result,
                board: game.board
            });

            return;
        }

        if (result === "DRAW") {
            game.gameOver = true;

            console.log("Match nul !");

            io.to(gameId).emit("tictactoe-game-over", {
                result: "DRAW",
                board: game.board
            });

            return;
        }

        game.currentPlayer = symbol === "X" ? "O" : "X";

        console.log(
            `${socket.id} joue sur la case ${index} avec le symbole ${symbol}`
        );

        console.log("Plateau :", game.board);
        console.log(
            "Prochain joueur :",
            game.currentPlayer
        );

        io.to(gameId).emit("tictactoe-update", {
            board: game.board,
            currentPlayer: game.currentPlayer
        });
    });

    socket.on("leave-tictactoe", ({ gameId }) => {
        console.log(
            `${socket.id} demande à quitter la partie ${gameId}`
        );

        const game = games[gameId];

        if (!game) {
            console.log("Partie inexistante.");
            return;
        }

        let symbol = null;

        if (game.players.X === socket.id) {
            symbol = "X";
        } else if (game.players.O === socket.id) {
            symbol = "O";
        }

        if (symbol === null) {
            console.log(
                "Ce joueur ne fait pas partie de cette partie."
            );
            return;
        }

        const opponentSymbol =
            symbol === "X" ? "O" : "X";

        const opponentConnected =
            game.players[opponentSymbol] !== null;

        const gameStarted =
            game.board.some((cell) => cell !== null);

        if (
            gameStarted &&
            opponentConnected &&
            !game.gameOver
        ) {
            game.gameOver = true;

            console.log(
                `Le joueur ${opponentSymbol} gagne par abandon.`
            );

            io.to(gameId).emit("tictactoe-game-over", {
                result: opponentSymbol,
                board: game.board,
                reason: "disconnect"
            });
        }

        game.players[symbol] = null;

        console.log(
            `La place ${symbol} de ${gameId} est libérée.`
        );

        if (
            game.players.X === null &&
            game.players.O === null
        ) {
            resetGame(game);
        }

        socket.data.leftTictactoe = true;

        socket.leave(gameId);
    });

    socket.on("disconnect", () => {
        console.log(
            "Un joueur s'est déconnecté :",
            socket.id
        );

        if (socket.data.leftTictactoe) {
            console.log(
                "Déconnexion déjà traitée : le joueur avait quitté volontairement."
            );
        } else {
            for (const game of Object.values(games)) {
                let disconnectedSymbol = null;

                if (game.players.X === socket.id) {
                    disconnectedSymbol = "X";
                } else if (game.players.O === socket.id) {
                    disconnectedSymbol = "O";
                }

                if (disconnectedSymbol === null) {
                    continue;
                }

                const opponentSymbol =
                    disconnectedSymbol === "X"
                        ? "O"
                        : "X";

                const opponentConnected =
                    game.players[opponentSymbol] !== null;

                const gameStarted =
                    game.board.some((cell) => cell !== null);

                if (
                    gameStarted &&
                    opponentConnected &&
                    !game.gameOver
                ) {
                    game.gameOver = true;

                    console.log(
                        `Le joueur ${opponentSymbol} gagne par abandon.`
                    );

                    io.to(game.id).emit(
                        "tictactoe-game-over",
                        {
                            result: opponentSymbol,
                            board: game.board,
                            reason: "disconnect"
                        }
                    );
                }

                game.players[disconnectedSymbol] = null;

                console.log(
                    `La place ${disconnectedSymbol} de ${game.id} est libérée.`
                );

                if (
                    game.players.X === null &&
                    game.players.O === null
                ) {
                    resetGame(game);
                }
            }
        }

        if (bombe.joueurs.includes(socket.id)) {
            const indexJoueur =
                bombe.joueurs.indexOf(socket.id);

            bombe.joueurs.splice(indexJoueur, 1);

            console.log(
                `Le joueur ${socket.id} quitte La Bombe.`
            );

            if (bombe.joueurs.length === 0) {
                reinitialiserBombe();

                console.log(
                    "La partie de La Bombe est réinitialisée."
                );
            } else {
                clearInterval(bombe.chronoInterval);

                bombe.chronoInterval = null;
                bombe.tempsRestant = 30;

                if (
                    bombe.indexJoueurActuel >=
                    bombe.joueurs.length
                ) {
                    bombe.indexJoueurActuel = 0;
                }

                io.to("bombe").emit(
                    "bombe-maj-joueurs",
                    {
                        joueurs: bombe.joueurs
                    }
                );

                io.to("bombe").emit(
                    "bombe-joueur-parti"
                );

                console.log(
                    "La Bombe est en attente d'un nouveau joueur."
                );
            }
        }
    });

    socket.on("bombe-soumettre-mot", (mot) => {
        const motNormalise = mot.toLowerCase().trim();

        if (
            bombe.joueurs[bombe.indexJoueurActuel] !==
            socket.id
        ) {
            socket.emit(
                "bombe-erreur",
                "Ce n'est pas votre tour."
            );
            return;
        }

        if (!dictionnaire.includes(motNormalise)) {
            socket.emit(
                "bombe-erreur",
                "Ce mot n'existe pas dans le dictionnaire."
            );
            return;
        }

        if (
            !motNormalise.includes(
                bombe.syllabeActuelle
            )
        ) {
            socket.emit(
                "bombe-erreur",
                `Le mot doit contenir la syllabe "${bombe.syllabeActuelle}".`
            );
            return;
        }

        if (
            bombe.listeMotsUtilises.includes(
                motNormalise
            )
        ) {
            socket.emit(
                "bombe-erreur",
                "Ce mot a déjà été utilisé."
            );
            return;
        }

        bombe.listeMotsUtilises.push(motNormalise);

        io.to("bombe").emit(
            "bombe-mot-valide",
            motNormalise
        );

        bombe.indexJoueurActuel =
            (bombe.indexJoueurActuel + 1) %
            bombe.joueurs.length;

        const syllabe = nouvelleMancheBombe();

        io.to("bombe").emit(
            "bombe-nouveau-round",
            {
                syllabe: syllabe,
                joueurActuel:
                    bombe.joueurs[
                        bombe.indexJoueurActuel
                    ],
                listeMotsUtilises:
                    bombe.listeMotsUtilises
            }
        );

        demarrerChronoBombe();
    });

    socket.on("join-bombe", () => {
        if (bombe.joueurs.includes(socket.id)) {
            return;
        }

        bombe.joueurs.push(socket.id);

        console.log(
            `Le joueur ${socket.id} rejoint La Bombe.`
        );

        socket.join("bombe");

        io.to("bombe").emit(
            "bombe-maj-joueurs",
            {
                joueurs: bombe.joueurs
            }
        );

        if (bombe.joueurs.length === 1) {
            const syllabe = nouvelleMancheBombe();

            io.to("bombe").emit(
                "bombe-nouveau-round",
                {
                    syllabe: syllabe,
                    joueurActuel:
                        bombe.joueurs[
                            bombe.indexJoueurActuel
                        ],
                    listeMotsUtilises:
                        bombe.listeMotsUtilises
                }
            );
        } else if (bombe.joueurs.length === 2) {
            io.to("bombe").emit(
                "bombe-nouveau-round",
                {
                    syllabe: bombe.syllabeActuelle,
                    joueurActuel:
                        bombe.joueurs[
                            bombe.indexJoueurActuel
                        ],
                    listeMotsUtilises:
                        bombe.listeMotsUtilises
                }
            );

            demarrerChronoBombe();
        }
    });

    socket.on("join-blindtest", () => {
        socket.join("blindtest");

        if (!blindtest.enCours) {
            lancerNouveauMorceau();
        } else {
            socket.emit(
                "blindtest-nouveau-morceau",
                blindtest.morceauActuel.fichier
            );
        }
    });

    socket.on("join-gamepixel", () => {
        socket.join("gamepixel");

        if (!gamepixel.enCours) {
            lancerNouvelleImage();
        }

        socket.emit(
            "gamepixel-nouvelle-image",
            gamepixel.imageActuelle.fichier
        );
    });

    socket.on("gp-soumettre-reponse", (reponse) => {
        const reponseNormalisee = reponse
            .toLowerCase()
            .trim();

        if (!gamepixel.imageActuelle) {
            socket.emit(
                "gp-erreur",
                "Aucune image n'est actuellement affichée."
            );
            return;
        }

        const bonnesReponses =
            gamepixel.imageActuelle.reponses;

        const reponseCorrecte =
            bonnesReponses.some(
                (bonneReponse) =>
                    bonneReponse.toLowerCase().trim() ===
                    reponseNormalisee
            );

        if (reponseCorrecte) {
            gamepixel.enCours = false;

            const temps = (Date.now() - gamepixel.debutManche) / 1000;
            const points = calculerPoints(temps, 45);

            ajouterPoints(socket.id, points);

            io.to("gamepixel").emit(
                "gp-victoire",
                {
                    gagnant: socket.id,
                    reponse: reponseNormalisee,
                    score: scores[socket.id]
                }
            );

            setTimeout(() => {
                lancerNouvelleImage();
            }, 3000);
        } else {
            socket.emit("gp-erreur", "Mauvaise réponse !");
        }
    });

    socket.on("bt-soumettre-reponse", (reponse) => {
        const reponseNormalisee = reponse
            .toLowerCase()
            .trim();

        if (!blindtest.morceauActuel) {
            socket.emit(
                "bt-erreur",
                "Aucun morceau n'est actuellement joué."
            );
            return;
        }

        const bonnesReponses =
            blindtest.morceauActuel.reponses;

        const reponseCorrecte =
            bonnesReponses.some(
                (bonneReponse) =>
                    bonneReponse.toLowerCase().trim() ===
                    reponseNormalisee
            );

        if (reponseCorrecte) {
            blindtest.enCours = false;

            ajouterPoint(socket.id);

            io.to("blindtest").emit(
                "bt-victoire",
                {
                    gagnant: socket.id,
                    reponse: reponseNormalisee,
                    score: scores[socket.id]
                }
            );

            setTimeout(() => {
                lancerNouveauMorceau();
            }, 3000);
        } else {
            socket.emit("bt-reponse-incorrecte");
        }
    });
});

server.listen(PORT, () => {
    console.log(
        `RuvGames est lancé sur http://localhost:${PORT}`
    );
});