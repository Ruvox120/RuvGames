const socket = io();

const params = new URLSearchParams(window.location.search);
const gameId = params.get("game");

document.getElementById("leave-button").addEventListener("click", () => {
    const confirmed = confirm(
        "Êtes-vous sûr de vouloir quitter la partie ?"
    );

    if (!confirmed) {
        return;
    }

    socket.emit("leave-tictactoe", {
        gameId: gameId
    });

    window.location.href = "index.html";
});

document.querySelectorAll(".cell").forEach((cell) => {
    cell.disabled = true;
});

document.querySelectorAll(".cell").forEach((cell) => {
    cell.addEventListener("click", () => {
        const index = Number(cell.dataset.index);

        socket.emit("tictactoe-move", {
            gameId: gameId,
            index: index
        });
    });
});

function rejoindrePartie() {
    const password = document.getElementById("password").value;

    socket.emit("join-tictactoe", {
        gameId: gameId,
        password: password
    });
}

document.getElementById("join-button").addEventListener("click", () => {
    rejoindrePartie();
});

document.getElementById("password").addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
        rejoindrePartie();
    }
});

socket.on("connect", () => {
    document.getElementById("status").textContent =
        "Entrez le mot de passe pour rejoindre la partie.";
});

socket.on("tictactoe-role", (symbol) => {
    if (symbol === null) {
        document.getElementById("status").textContent =
            "La partie est complète.";
        return;
    }

    document.getElementById("status").textContent =
        `Vous êtes ${symbol}`;

    document.querySelectorAll(".cell").forEach((cell) => {
        cell.disabled = false;
    });
});

socket.on("tictactoe-error", (message) => {
    document.getElementById("status").textContent = message;
});

socket.on("tictactoe-update", ({ board, currentPlayer }) => {
    document.querySelectorAll(".cell").forEach((cell, index) => {
        cell.textContent = board[index] || "";
    });

    document.getElementById("status").textContent =
        `Tour de ${currentPlayer}`;
});

socket.on("tictactoe-game-over", ({ result, board }) => {
    document.querySelectorAll(".cell").forEach((cell, index) => {
        cell.textContent = board[index] || "";
        cell.disabled = true;
    });

    if (result === "DRAW") {
        document.getElementById("status").textContent =
            "Match nul !";
    } else {
        document.getElementById("status").textContent =
            `Le joueur ${result} a gagné !`;
    }
});