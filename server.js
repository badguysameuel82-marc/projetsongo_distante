const express = require('express');
const cors = require('cors');
const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

let salons = {}; 

function genererCodeSalon() {
    const lettres = "ABCDEFGHIJKLMNPQRSTUVWXYZ123456789";
    let code = "";
    for (let i = 0; i < 4; i++) code += lettres.charAt(Math.floor(Math.random() * lettres.length));
    return code;
}

function simulerUnCoup(plateauActuel, indexDepart, joueur) {
    let copiePlateau = [...plateauActuel];
    let graines = copiePlateau[indexDepart];
    copiePlateau[indexDepart] = 0;
    let idx = indexDepart;

    while (graines > 0) {
        idx = (idx + 1) % 14;
        if (idx === indexDepart) continue;
        copiePlateau[idx]++;
        graines--;
    }

    let points = 0;
    const adverse = (joueur === 1 && idx >= 7 && idx <= 13) || (joueur === 2 && idx >= 0 && idx <= 6);
    if (adverse) {
        while (true) {
            let g = copiePlateau[idx];
            if (g === 2 || g === 3 || g === 4) {
                points += g;
                copiePlateau[idx] = 0;
                idx = (idx - 1 + 14) % 14;
                const tjrsAdverse = (joueur === 1 && idx >= 7 && idx <= 13) || (joueur === 2 && idx >= 0 && idx <= 6);
                if (!tjrsAdverse) break;
            } else {
                break;
            }
        }
    }
    return { plateauResultat: copiePlateau, pointsCaptures: points };
}

// IA Aléatoire ou Stratégique simplifiée
function calculerCoupMachine(plateau, difficulte) {
    let coupsPossibles = [];
    for (let i = 7; i <= 13; i++) {
        if (plateau[i] > 0) coupsPossibles.push(i);
    }
    if (coupsPossibles.length === 0) return -1;

    if (difficulte === 'facile') {
        return coupsPossibles[Math.floor(Math.random() * coupsPossibles.length)];
    }
    
    // Mode normal/difficile : cherche un coup qui capture
    let meilleurCoup = coupsPossibles[0];
    let maxPoints = -1;
    
    for (let coup of coupsPossibles) {
        let res = simulerUnCoup(plateau, coup, 2);
        if (res.pointsCaptures > maxPoints) {
            maxPoints = res.pointsCaptures;
            meilleurCoup = coup;
        }
    }
    return meilleurCoup;
}

// INITIALISATION DU MODE IA (PVE)
app.post('/api/init-pve', (req, res) => {
    const { difficulte } = req.body;
    const codeId = "BOT_" + Math.random().toString(36).substring(2, 7).toUpperCase();
    
    salons[codeId] = {
        code: codeId,
        mode: 'pve',
        difficulte: difficulte,
        plateau: [5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5],
        tourJoueur: 1,
        statut: 'en_cours',
        j1: { pseudo: "Joueur 1", scoreActuel: 0, victoiresTotales: 0 },
        j2: { pseudo: "Machine", scoreActuel: 0, victoiresTotales: 0 }
    };
    res.json({ status: "success", code: codeId, salon: salons[codeId] });
});

// CRÉER UN SALON EN LIGNE (PVP)
app.post('/api/creer-salon', (req, res) => {
    const { pseudo } = req.body;
    const code = genererCodeSalon();

    salons[code] = {
        code: code,
        mode: 'pvp',
        plateau: [5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5],
        tourJoueur: 1,
        statut: 'attente',
        j1: { pseudo: pseudo || "Joueur 1", scoreActuel: 0, victoiresTotales: 0 },
        j2: null
    };
    res.json({ status: "success", code: code, salon: salons[code] });
});

// REJOINDRE UN SALON EN LIGNE
app.post('/api/rejoindre-salon', (req, res) => {
    const { code, pseudo } = req.body;
    const salonId = code.toUpperCase();

    if (!salons[salonId]) return res.status(404).json({ status: "error", message: "Code introuvable !" });
    if (salons[salonId].j2 !== null) return res.status(400).json({ status: "error", message: "Salon complet !" });

    salons[salonId].j2 = { pseudo: pseudo || "Joueur 2", scoreActuel: 0, victoiresTotales: 0 };
    salons[salonId].statut = 'en_cours';
    res.json({ status: "success", salon: salons[salonId] });
});

app.get('/api/salon/:code', (req, res) => {
    const salonId = req.params.code.toUpperCase();
    if (!salons[salonId]) return res.status(404).json({ status: "error" });
    res.json({ status: "success", salon: salons[salonId] });
});

// JOUER UN COUP (GÈRE PVP ET PVE SIMULTANÉMENT)
app.post('/api/salon/:code/jouer', (req, res) => {
    const salonId = req.params.code.toUpperCase();
    const { indexDepart, joueurNumero } = req.body;

    let s = salons[salonId];
    if (!s) return res.status(404).json({ status: "error", message: "Partie introuvable" });
    if (s.tourJoueur !== joueurNumero) return res.status(400).json({ status: "error", message: "Pas ton tour !" });

    let simulation = simulerUnCoup(s.plateau, indexDepart, joueurNumero);
    let plateauIntermediaire = [...s.plateau];
    s.plateau = simulation.plateauResultat;

    if (joueurNumero === 1) s.j1.scoreActuel += simulation.pointsCaptures;
    else s.j2.scoreActuel += simulation.pointsCaptures;

    let coupMachine = -1;

    // Vérifier fin de manche
    if (s.j1.scoreActuel >= 36) {
        s.statut = 'fini';
        s.j1.victoiresTotales++;
    } else if (s.j2.scoreActuel >= 36) {
        s.statut = 'fini';
        s.j2.victoiresTotales++;
    } else {
        // Changement de tour
        s.tourJoueur = (s.tourJoueur === 1) ? 2 : 1;

        // Si mode Robot, il réplique immédiatement dans la même requête
        if (s.mode === 'pve' && s.tourJoueur === 2) {
            coupMachine = calculerCoupMachine(s.plateau, s.difficulte);
            if (coupMachine !== -1) {
                let simBot = simulerUnCoup(s.plateau, coupMachine, 2);
                s.plateau = simBot.plateauResultat;
                s.j2.scoreActuel += simBot.pointsCaptures;

                if (s.j2.scoreActuel >= 36) {
                    s.statut = 'fini';
                    s.j2.victoiresTotales++;
                } else {
                    s.tourJoueur = 1;
                }
            }
        }
    }

    res.json({ 
        status: "success", 
        salon: s, 
        captures: simulation.pointsCaptures, 
        plateauIntermediaire: plateauIntermediaire,
        coupMachine: coupMachine
    });
});

app.post('/api/salon/:code/reset', (req, res) => {
    const salonId = req.params.code.toUpperCase();
    if (!salons[salonId]) return res.status(404).json({ status: "error" });

    salons[salonId].plateau = [5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5];
    salons[salonId].j1.scoreActuel = 0;
    salons[salonId].j2.scoreActuel = 0;
    salons[salonId].tourJoueur = 1;
    salons[salonId].statut = 'en_cours';
    res.json({ status: "success", salon: salons[salonId] });
});

app.post('/api/salon/:code/clear-stats', (req, res) => {
    const salonId = req.params.code.toUpperCase();
    if (salons[salonId]) {
        salons[salonId].j1.victoiresTotales = 0;
        salons[salonId].j2.victoiresTotales = 0;
    }
    res.json({ status: "success", salon: salons[salonId] });
});

app.listen(PORT, () => {
    console.log(`🚀 Serveur Songo Pro Universel en ligne sur le port ${PORT}`);
});