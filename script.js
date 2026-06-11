const SERVEUR_URL = window.location.origin;

let codeSalonActuel = null;
let monNumeroJoueur = 1; 
let plateau = [5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5];
let enTrainDeSemer = false;
let intervalSynchro = null;
let modeActuel = 'pve';

function afficherSalon(salon) {
    plateau = salon.plateau;
    modeActuel = salon.mode;
    
    // Mise à jour des profils et scores du Joueur 1
    document.getElementById('txt-p1-name').innerText = salon.j1.pseudo;
    document.getElementById('score-p1').innerText = salon.j1.scoreActuel;
    document.getElementById('wins-p1').innerText = salon.j1.victoiresTotales;

    // Mise à jour du Joueur 2 s'il est présent
    if (salon.j2) {
        document.getElementById('txt-p2-name').innerText = salon.j2.pseudo;
        document.getElementById('score-p2').innerText = salon.j2.scoreActuel;
        document.getElementById('wins-p2').innerText = salon.j2.victoiresTotales;
    }

    // Rendu visuel des graines dans les trous
    const trousHtml = document.querySelectorAll('.hole');
    trousHtml.forEach(trou => {
        const index = parseInt(trou.getAttribute('data-index'));
        const nbrGraines = plateau[index];
        trou.setAttribute('data-count', nbrGraines);
        trou.innerHTML = '';
        for (let i = 0; i < nbrGraines; i++) {
            const graine = document.createElement('div');
            graine.classList.add('seed');
            graine.style.transform = `translate(${Math.floor(Math.random()*10)-5}px, ${Math.floor(Math.random()*10)-5}px)`;
            trou.appendChild(graine);
        }
    });

    const ind = document.getElementById('turn-indicator');
    const diffSpan = document.getElementById('diff-span');
    
    // Configuration de l'icône de l'adversaire selon le mode
    if (salon.mode === 'pve') {
        diffSpan.innerText = ` (${salon.difficulte.toUpperCase()})`;
        document.getElementById('icon-p2').className = "fa-solid fa-robot";
    } else {
        diffSpan.innerText = "";
        document.getElementById('icon-p2').className = "fa-solid fa-user-ninja";
    }

    // --- CORRECTION CRITIQUE DU MESSAGE DE STATUT ET DE TOUR ---
    if (salon.statut === 'attente') {
        ind.innerText = "En attente de l'adversaire...";
        ind.style.color = "#e67e22";
    } else if (salon.statut === 'fini') {
        ind.innerText = "Partie terminée !";
        ind.style.color = "#f1c40f";
        document.getElementById('victory-screen').classList.remove('hidden');
        document.getElementById('victory-msg').innerText = salon.j1.scoreActuel >= 36 ? `${salon.j1.pseudo} Gagne !` : `${salon.j2.pseudo} Gagne !`;
    } else {
        // Le salon est bien 'en_cours'
        if (parseInt(salon.tourJoueur) === parseInt(monNumeroJoueur)) {
            ind.innerText = "👉 C'est ton tour !";
            ind.style.color = "#2ecc71";
        } else {
            ind.innerText = (salon.mode === 'pve') ? "🤖 La machine réfléchit..." : "⏳ Tour de l'adversaire...";
            ind.style.color = "#e74c3c";
        }
    }
}

async function synchroniserSalon() {
    if (enTrainDeSemer || !codeSalonActuel || modeActuel === 'pve') return;
    try {
        const response = await fetch(`${SERVEUR_URL}/api/salon/${codeSalonActuel}`);
        const data = await response.json();
        if (data.status === "success") {
            afficherSalon(data.salon);
        }
    } catch (e) {}
}

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function animerSemis(indexDepart, nouvelEtatPlateau) {
    let graines = plateau[indexDepart];
    plateau[indexDepart] = 0;
    
    let idx = indexDepart;
    document.getElementById('sound-sow').play().catch(()=>{});

    while(graines > 0) {
        idx = (idx + 1) % 14;
        if(idx === indexDepart) continue;
        plateau[idx]++;
        graines--;
        
        let currentHole = document.querySelector(`.hole[data-index="${idx}"]`);
        if(currentHole) currentHole.classList.add('sowing-active');
        
        currentHole.setAttribute('data-count', plateau[idx]);
        await sleep(200);
        if(currentHole) currentHole.classList.remove('sowing-active');
    }
}

document.addEventListener("DOMContentLoaded", () => {
    
    // Gestion des menus d'aiguillage
    document.getElementById('btn-pvp-menu').addEventListener('click', () => {
        document.getElementById('main-menu-buttons').classList.add('hidden');
        document.getElementById('online-setup-zone').classList.remove('hidden');
    });

    document.getElementById('btn-cancel-online').addEventListener('click', () => {
        document.getElementById('online-setup-zone').classList.add('hidden');
        document.getElementById('main-menu-buttons').classList.remove('hidden');
    });

    document.getElementById('btn-pve').addEventListener('click', () => {
        document.getElementById('difficulty-modal').classList.remove('hidden');
    });

    document.getElementById('btn-close-modal').addEventListener('click', () => {
        document.getElementById('difficulty-modal').classList.add('hidden');
    });

    // Lancement du mode Robot (PVE)
    document.querySelectorAll('.btn-diff').forEach(btn => {
        btn.addEventListener('click', async () => {
            const diff = btn.getAttribute('data-diff');
            document.getElementById('difficulty-modal').classList.add('hidden');

            const res = await fetch(`${SERVEUR_URL}/api/init-pve`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ difficulte: diff })
            });
            const d = await res.json();
            if (d.status === "success") {
                codeSalonActuel = d.code;
                monNumeroJoueur = 1;
                document.getElementById('room-code-display-zone').classList.add('hidden');
                document.getElementById('clear-stats-zone').classList.add('hidden');
                document.getElementById('welcome-section').classList.add('hidden');
                document.getElementById('game-section').classList.remove('hidden');
                afficherSalon(d.salon);
            }
        });
    });

    // Création d'un salon privé en ligne (PVP)
    document.getElementById('btn-create-room').addEventListener('click', async () => {
        const pseudo = document.getElementById('user-pseudo').value || "Joueur 1";
        const res = await fetch(`${SERVEUR_URL}/api/creer-salon`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ pseudo: pseudo })
        });
        const d = await res.json();
        if(d.status === "success") {
            codeSalonActuel = d.code;
            monNumeroJoueur = 1; // Le créateur est TOUJOURS le Joueur 1
            document.getElementById('display-room-code').innerText = codeSalonActuel;
            document.getElementById('room-code-display-zone').classList.remove('hidden');
            document.getElementById('clear-stats-zone').classList.remove('hidden');
            document.getElementById('welcome-section').classList.add('hidden');
            document.getElementById('game-section').classList.remove('hidden');
            afficherSalon(d.salon);
            intervalSynchro = setInterval(synchroniserSalon, 1500);
        }
    });

    // Rejoindre un salon existant via le Code
    document.getElementById('btn-join-room').addEventListener('click', async () => {
        const pseudo = document.getElementById('user-pseudo').value || "Joueur 2";
        const code = document.getElementById('room-code-input').value.toUpperCase();

        const res = await fetch(`${SERVEUR_URL}/api/rejoindre-salon`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ code: code, pseudo: pseudo })
        });
        const d = await res.json();
        if(d.status === "success") {
            codeSalonActuel = code;
            monNumeroJoueur = 2; // Celui qui rejoint est TOUJOURS le Joueur 2
            document.getElementById('display-room-code').innerText = codeSalonActuel;
            document.getElementById('room-code-display-zone').classList.remove('hidden');
            document.getElementById('clear-stats-zone').classList.remove('hidden');
            document.getElementById('welcome-section').classList.add('hidden');
            document.getElementById('game-section').classList.remove('hidden');
            afficherSalon(d.salon);
            intervalSynchro = setInterval(synchroniserSalon, 1500);
        } else {
            alert(d.message);
        }
    });

    // Clics sur les cases du plateau
    document.querySelectorAll('.hole').forEach(trou => {
        trou.addEventListener('click', async () => {
            if (enTrainDeSemer || !codeSalonActuel) return;
            const index = parseInt(trou.getAttribute('data-index'));
            
            // Sécurité : Vérifier que le joueur clique bien dans sa propre rangée
            if (monNumeroJoueur === 1 && (index < 0 || index > 6)) return;
            if (monNumeroJoueur === 2 && (index < 7 || index > 13)) return;
            if (plateau[index] === 0) return;

            enTrainDeSemer = true;
            
            const res = await fetch(`${SERVEUR_URL}/api/salon/${codeSalonActuel}/jouer`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ indexDepart: index, joueurNumero: monNumeroJoueur })
            });
            const d = await res.json();
            
            if (d.status === "success") {
                await animerSemis(index, d.plateauIntermediaire);
                
                if (d.captures > 0) {
                    document.getElementById('sound-capture').play().catch(()=>{});
                }

                if (d.coupMachine !== -1) {
                    await sleep(800);
                    await animerSemis(d.coupMachine, d.salon.plateau);
                }

                afficherSalon(d.salon);
            } else {
                alert(d.message); // Affiche "Ce n'est pas votre tour !" si on force le clic
            }
            enTrainDeSemer = false;
        });
    });

    document.getElementById('btn-clear-stats').addEventListener('click', async () => {
        if(!codeSalonActuel) return;
        const res = await fetch(`${SERVEUR_URL}/api/salon/${codeSalonActuel}/clear-stats`, { method: 'POST' });
        const d = await res.json();
        if(d.status === "success") afficherSalon(d.salon);
    });

    document.getElementById('btn-reset').addEventListener('click', async () => {
        if(!codeSalonActuel) return;
        const res = await fetch(`${SERVEUR_URL}/api/salon/${codeSalonActuel}/reset`, { method: 'POST' });
        const d = await res.json();
        if(d.status === "success") {
            document.getElementById('victory-screen').classList.add('hidden');
            afficherSalon(d.salon);
        }
    });

    document.getElementById('btn-restart').addEventListener('click', () => document.getElementById('btn-reset').click());

    document.getElementById('btn-back').addEventListener('click', () => {
        clearInterval(intervalSynchro);
        document.getElementById('game-section').classList.add('hidden');
        document.getElementById('online-setup-zone').classList.add('hidden');
        document.getElementById('main-menu-buttons').classList.remove('hidden');
        document.getElementById('welcome-section').classList.remove('hidden');
    });
});