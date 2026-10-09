const socket = io();

socket.emit("join-bombe");

const status = document.getElementById("status");
const timer = document.getElementById("timer");
const wordInput = document.getElementById("word-input");
const submitButton = document.getElementById("submit-word");
const message = document.getElementById("message");
const syllableDisplay = document.getElementById("syllable");
const wordHistory = document.getElementById("word-history");

wordInput.disabled = true;
submitButton.disabled = true;

function soumettreMot() {
    const mot = wordInput.value;

    socket.emit("bombe-soumettre-mot", mot);
}

submitButton.addEventListener("click", () => {
    soumettreMot();
});

wordInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
        soumettreMot();
    }
});

socket.on("bombe-mot-valide", (mot) => {
    message.textContent = `Mot valide : ${mot}`;

    wordInput.value = "";

    const listItem = document.createElement("li");
    listItem.textContent = mot;

    wordHistory.appendChild(listItem);
});

socket.on("bombe-erreur", (erreur) => {
    message.textContent = erreur;
});

socket.on(
    "bombe-nouveau-round",
    ({
        syllabe,
        joueurActuel,
        listeMotsUtilises
    }) => {
        syllableDisplay.textContent = syllabe;

        wordHistory.innerHTML = "";

        if (listeMotsUtilises) {
            listeMotsUtilises.forEach((mot) => {
                const listItem =
                    document.createElement("li");

                listItem.textContent = mot;

                wordHistory.appendChild(listItem);
            });
        }

        if (socket.id === joueurActuel) {
            status.textContent = "À vous de jouer !";

            wordInput.disabled = false;
            submitButton.disabled = false;

            wordInput.focus();
        } else {
            status.textContent =
                "Tour de l'autre joueur.";

            wordInput.disabled = true;
            submitButton.disabled = true;
        }
    }
);

socket.on("bombe-tick-temps", (temps) => {
    timer.textContent = temps;
});

socket.on("bombe-explosion", ({ perdant }) => {
    wordHistory.innerHTML = "";

    if (socket.id === perdant) {
        status.textContent =
            "💥 La bombe a explosé !";
    } else {
        status.textContent =
            "💥 La bombe a explosé chez l'autre joueur.";
    }

    wordInput.disabled = true;
    submitButton.disabled = true;
});

socket.on("bombe-joueur-parti", () => {
    status.textContent =
        "L'autre joueur a quitté la partie. En attente d'un joueur...";

    wordInput.disabled = true;
    submitButton.disabled = true;

    timer.textContent = "30";
});