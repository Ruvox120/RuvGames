const socket = io();

const status = document.getElementById("status");
const image = document.getElementById("gamepixel-image");
const answerInput = document.getElementById("answer-input");
const submitButton = document.getElementById("submit-answer");
const message = document.getElementById("message");

status.textContent = "Connecté au serveur.";

socket.emit("join-gamepixel");

socket.on("gamepixel-nouvelle-image", (fichier) => {
    console.log("Image reçue :", fichier);

    // On remet complètement l'image dans son état initial
    image.classList.remove("devoile");
    image.classList.remove("reponse-trouvee");

    // On force immédiatement l'état flou
    image.style.transition = "none";
    image.style.filter = "blur(25px)";

    // Force le navigateur à appliquer réellement le flou
    void image.offsetWidth;

    // Nouvelle image
    image.src = `/images/${fichier}`;

    answerInput.disabled = false;
    submitButton.disabled = false;
    message.textContent = "";

    // Lorsque la nouvelle image est réellement chargée
    image.onload = () => {
        // On réactive la transition de 30 secondes
        image.style.transition = "filter 30s linear";

        // Puis on lance progressivement le dévoilement
        void image.offsetWidth;
        image.style.filter = "blur(0px)";
    };
});

function soumettreReponse() {
    const reponse = answerInput.value;

    socket.emit("gp-soumettre-reponse", reponse);
}

submitButton.addEventListener("click", () => {
    soumettreReponse();
});

answerInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
        soumettreReponse();
    }
});

socket.on("gp-erreur", (erreur) => {
    message.textContent = `❌ ${erreur}`;
});

socket.on("gp-victoire", ({ gagnant, reponse, score }) => {
    if (socket.id === gagnant) {
        message.textContent =
            `🏆 Bonne réponse ! Vous avez trouvé : ${reponse} — Score : ${score}`;
    } else {
        message.textContent =
            `🏆 ${reponse} — un autre joueur a trouvé la bonne réponse.`;
    }

    image.classList.remove("devoile");
    image.classList.add("reponse-trouvee");

    image.style.transition = "none";
    image.style.filter = "blur(0px)";

    answerInput.disabled = true;
    submitButton.disabled = true;
});