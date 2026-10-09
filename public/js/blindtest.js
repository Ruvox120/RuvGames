const socket = io();

const status = document.getElementById("status");
const answerInput = document.getElementById("answer-input");
const submitButton = document.getElementById("submit-answer");
const message = document.getElementById("message");

status.textContent = "Connecté au serveur.";

socket.emit("join-blindtest");

socket.on("blindtest-nouveau-morceau", (fichier) => {
    console.log("Morceau reçu :", fichier);

    const audioPlayer = document.getElementById("audio-player");

    audioPlayer.src = `/musiques/${fichier}`;
    audioPlayer.play();

    answerInput.disabled = false;
    submitButton.disabled = false;
    message.textContent = "";
});

function soumettreReponse() {
    const reponse = answerInput.value;

    socket.emit("bt-soumettre-reponse", reponse);
}

submitButton.addEventListener("click", () => {
    soumettreReponse();
});

answerInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
        soumettreReponse();
    }
});

socket.on("bt-reponse-correcte", () => {
    message.textContent = "✅ Bonne réponse !";
});

socket.on("bt-reponse-incorrecte", () => {
    message.textContent = "❌ Mauvaise réponse !";
});

socket.on("bt-victoire", ({ gagnant, reponse, score }) => {
    if (socket.id === gagnant) {
        message.textContent =
            `🏆 Bonne réponse ! Vous avez trouvé : ${reponse} — Score : ${score}`;
    } else {
        message.textContent =
            `🏆 ${reponse} — un autre joueur a trouvé la bonne réponse.`;
    }

    answerInput.disabled = true;
    submitButton.disabled = true;
});