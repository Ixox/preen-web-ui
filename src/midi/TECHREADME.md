# PreenFM3 MIDI - Documentation Technique

Documentation technique détaillée et exhaustive du protocole MIDI du PreenFM3 (Control Changes, NRPN et architecture interne).

> **Note** : Cette documentation a été mise à jour et vérifiée directement par rapport au code source du firmware PreenFM3 2.x (`MidiDecoder.h`, `MidiDecoder.cpp`, `SynthState.h`, `Common.h`, `FMDisplayEditor.cpp`).

---

## Table des matières

- [Vue d'ensemble](#vue-densemble)
- [Control Changes (CC)](#control-changes-cc)
  - [Cheat Sheet complète (0-127)](#cheat-sheet-complète-cc-0-127)
  - [Engine et Modulation FM](#engine-et-modulation-fm)
  - [Mix et Pan des Opérateurs](#mix-et-pan-des-opérateurs)
  - [Fréquences des Opérateurs](#fréquences-des-opérateurs)
  - [Warp des Opérateurs](#warp-des-opérateurs)
  - [Phase des Opérateurs (NRPN exclusif)](#phase-des-opérateurs)
  - [Filtres / Effets 1 & 2](#filtres--effets-1--2)
  - [Enveloppes des Opérateurs](#enveloppes-des-opérateurs)
  - [LFOs et Enveloppes Libres](#lfos-et-enveloppes-libres)
  - [Mixeur, Dynamique, Reverb Dry/Wet & Master FX](#mixeur-profils-de-dynamique-reverb-drywet--master-fx-cc-7-10-11-40-41-44-45)
  - [Performance, Matrice & Unison](#performance-matrice--unison)
  - [Arpeggiateur et Séquenceur](#arpeggiateur-et-séquenceur)
- [NRPN (Non-Registered Parameter Numbers)](#nrpn-non-registered-parameter-numbers)
  - [Structure des messages](#structure-des-messages-nrpn)
  - [Commandes spéciales](#commandes-spéciales-nrpn)
  - [Note Curves (Éclaircissement technique)](#note-curves)
  - [Phase des Opérateurs (Détail NRPN)](#phase-des-opérateurs-détail-nrpn)
  - [Step Sequencers](#step-sequencers)
  - [Timbre & Master FX (NRPN 512-515)](#timbre--master-fx-nrpn-512-515)
  - [Algorithme de transformation mémoire ↔ MIDI](#algorithme-de-transformation-mémoire--midi)
  - [Scalings des paramètres](#scalings-des-paramètres)
- [LFO MIDI Clock Mode](#lfo-midi-clock-mode)
- [Références firmware](#références-firmware)

---

## Vue d'ensemble

Le PreenFM3 propose deux niveaux de contrôle MIDI :

1. **Control Changes (CC, résolution 7 bits : 0-127)** : Destinés au contrôle temps réel (potentiomètres, faders, automations DAW) pour les paramètres essentiels de synthèse, filtres, mixeur et effets.
2. **NRPN (résolution 14 bits : 0-16383)** : Accès complet à l'ensemble des ~300 paramètres du moteur sonore, y compris les paramètres non mappés en CC (formes d'onde, routage complet de la matrice, points d'enveloppe détaillés, etc.) et les dumps de patchs.

---

## Control Changes (CC)

### Cheat Sheet complète (CC 0-127)

| CC | Paramètre | Destination / Fonction |
|:---|:---|:---|
| **0** | Bank Select MSB | Sélection de banque (0-127) |
| **1** | Modulation Wheel | Source matrice `MATRIX_SOURCE_MODWHEEL` |
| **2** | Breath Controller | Source matrice `MATRIX_SOURCE_BREATH` |
| **5** | Glide Speed | Vitesse de portamento / glide (`ROW_ENGINE`, 0-12) |
| **7** | Mixer Volume | Volume du timbre courant (0.0 - 1.0) |
| **10** | Mixer Pan | Panoramique du timbre courant (-63 à +64) |
| **11** | Mixer Send | Envoi Master FX du timbre courant (0.0 - 1.0) |
| **13** | Unison Detune | Désaccordage de l'unisson (-1.0 à +1.0) |
| **14** | Unison Spread | Écartement stéréo de l'unisson (0.0 à 1.0) |
| **16** | Algorithm | Algorithme FM (0-31) |
| **17** | IM1 | Index de modulation 1 (0.0 - 10.0) |
| **18** | IM2 | Index de modulation 2 (0.0 - 10.0) |
| **19** | IM3 | Index de modulation 3 (0.0 - 10.0) |
| **20** | IM4 | Index de modulation 4 (0.0 - 10.0) |
| **21** | IM5 | Index de modulation 5 (0.0 - 10.0) |
| **22** | Mix OP1 | Niveau de sortie OP1 (0.0 - 1.0) |
| **23** | Pan OP1 | Panoramique OP1 (-1.0 à +1.0, 64 = centre) |
| **24** | Mix OP2 | Niveau de sortie OP2 (0.0 - 1.0) |
| **25** | Pan OP2 | Panoramique OP2 (-1.0 à +1.0) |
| **26** | Mix OP3 | Niveau de sortie OP3 (0.0 - 1.0) |
| **27** | Pan OP3 | Panoramique OP3 (-1.0 à +1.0) |
| **28** | Mix OP4 | Niveau de sortie OP4 (0.0 - 1.0) |
| **29** | Pan OP4 | Panoramique OP4 (-1.0 à +1.0) |
| **30** | IM Feedback | Index de feedback FM (0.0 - 1.0) |
| **31** | Mix OP5 | Niveau de sortie OP5 (0.0 - 1.0) |
| **32** | Bank Select LSB | Sélection de banque LSB |
| **33** | Warp OP1 | Courbure de phase OP1 (-4.0 à +4.0) |
| **34** | Warp OP2 | Courbure de phase OP2 (-4.0 à +4.0) |
| **35** | Warp OP3 | Courbure de phase OP3 (-4.0 à +4.0) |
| **36** | Pan OP5 | Panoramique OP5 (-1.0 à +1.0) |
| **37** | Mix OP6 | Niveau de sortie OP6 (0.0 - 1.0) |
| **38** | Data Entry LSB | Protocole standard NRPN LSB |
| **39** | Pan OP6 | Panoramique OP6 (-1.0 à +1.0) |
| **40** | Timbre Dry/Wet | Reverb Dry/Wet du timbre courant (0.0 - 1.0) |
| **41** | Timbre Dynamics | Profil de compression/saturation (0:Off, 1:Glue, 2:Punch, 3:Tube, 4:Limit, 5:Drive, 6:Fuzz) |
| **42** | Engine Decimation | Effet lo-fi décimation (0..18: 1bit..19bit, 19: Full, 20: HQ) |
| **43** | Play Mode | Mode de jeu (0:Mono, 1:Poly, 2:Unison) |
| **44** | MFX Return Level | Niveau global de retour de réverbération (`reverbLevel_`) |
| **45** | MFX Preset | Sélection du preset d'effet Master (0-18) |
| **46** | Matrix Row 1 Mul | Multiplicateur rangée de matrice 1 (-10.0 à +15.4) |
| **47** | Matrix Row 2 Mul | Multiplicateur rangée de matrice 2 |
| **48** | Matrix Row 3 Mul | Multiplicateur rangée de matrice 3 |
| **49** | Matrix Row 4 Mul | Multiplicateur rangée de matrice 4 |
| **50** | Freq OP1 | Fréquence OP1 (ratio FM, pas de 1/12) |
| **51** | Freq OP2 | Fréquence OP2 |
| **52** | Freq OP3 | Fréquence OP3 |
| **53** | Freq OP4 | Fréquence OP4 |
| **54** | Freq OP5 | Fréquence OP5 |
| **55** | Freq OP6 | Fréquence OP6 |
| **56** | LFO1 Freq | Fréquence LFO 1 (pas de 0.2 Hz) |
| **57** | LFO2 Freq | Fréquence LFO 2 |
| **58** | LFO3 Freq | Fréquence LFO 3 |
| **59** | LFO Env2 Silence | Temps de silence LFO Free Env 2 (0-16s) |
| **62** | Env Atk All Mod | Attaque de tous les modulateurs de l'algo |
| **63** | Env Rel All Mod | Relâchement de tous les modulateurs de l'algo |
| **64** | Hold Pedal | Pédale de sustain standard |
| **65** | Env Atk OP1 | Attaque enveloppe OP1 (0-2s) |
| **66** | Filter 2 Type | Type d'effet / filtre 2 (Off, LP, HP, BP, etc.) |
| **67** | Filter 2 Param 1 | Cutoff / Fréquence du filtre 2 |
| **68** | Filter 2 Param 2 | Résonance / Q du filtre 2 |
| **69** | Filter 2 Mix | Mix dry/wet du filtre 2 |
| **70** | Filter 1 Type | Type d'effet / filtre 1 |
| **71** | Filter 1 Param 1 | Cutoff / Fréquence du filtre 1 |
| **72** | Filter 1 Param 2 | Résonance / Q du filtre 1 |
| **73** | Filter 1 Gain | Gain post-filtre 1 |
| **74** | MPE Slide (CC74) | Source matrice `MATRIX_SOURCE_MPESLIDE` |
| **75** | Env Atk OP2 | Attaque enveloppe OP2 |
| **76** | Env Atk OP3 | Attaque enveloppe OP3 |
| **77** | Env Atk OP4 | Attaque enveloppe OP4 |
| **78** | Env Atk OP5 | Attaque enveloppe OP5 |
| **79** | Env Atk OP6 | Attaque enveloppe OP6 |
| **80** | Env Atk All Car | Attaque de toutes les porteuses (carriers) |
| **81** | Env Rel All Car | Relâchement de toutes les porteuses |
| **82** | Env Rel OP1 | Relâchement enveloppe OP1 (0-4s) |
| **83** | Env Rel OP2 | Relâchement enveloppe OP2 |
| **84** | Env Rel OP3 | Relâchement enveloppe OP3 |
| **85** | Env Rel OP4 | Relâchement enveloppe OP4 |
| **86** | Env Rel OP5 | Relâchement enveloppe OP5 |
| **87** | Env Rel OP6 | Relâchement enveloppe OP6 |
| **88** | LFO1 Phase | Phase de départ LFO 1 (-4.0 à +1.0) |
| **89** | LFO2 Phase | Phase de départ LFO 2 |
| **90** | LFO3 Phase | Phase de départ LFO 3 |
| **91** | LFO1 Bias | Offset continu (DC) LFO 1 (0.0 - 1.27) |
| **92** | LFO2 Bias | Offset continu LFO 2 |
| **93** | LFO3 Bias | Offset continu LFO 3 |
| **94** | LFO1 Shape | Forme d'onde LFO 1 (0-7) |
| **95** | LFO2 Shape | Forme d'onde LFO 2 (0-7) |
| **96** | LFO3 Shape | Forme d'onde LFO 3 (0-7) |
| **96-99** | *Réservés NRPN* | Standard MIDI : 96=Data Inc, 97=Data Dec, 98=LSB, 99=MSB |
| **100** | Arp Clock | Synchronisation d'horloge Arpeggiateur |
| **101** | Arp Direction | Direction de l'arpeggiateur (Up, Down, UpDown, Random) |
| **102** | Arp Octave | Nombre d'octaves de l'arpeggiateur (1-4) |
| **103** | Arp Pattern | Motif de l'arpeggiateur |
| **104** | Arp Division | Division rythmique de l'arpeggiateur |
| **105** | Arp Duration | Durée de note de l'arpeggiateur |
| **106** | Seq Start All | Démarrage global des séquenceurs (tous timbres) |
| **107** | Seq Start Inst | Démarrage séquenceur du timbre courant |
| **108** | Seq Record Inst | Mode enregistrement séquenceur |
| **109** | Seq Sequence Num | Sélection du numéro de séquence |
| **110** | Seq Transpose | Transposition du séquenceur |
| **111** | Warp OP4 | Courbure de phase OP4 (-4.0 à +4.0) |
| **112** | Warp OP5 | Courbure de phase OP5 (-4.0 à +4.0) |
| **113** | Warp OP6 | Courbure de phase OP6 (-4.0 à +4.0) |
| **115** | User CC 1 | Source matrice Performance `MATRIX_SOURCE_USER_CC1` |
| **116** | User CC 2 | Source matrice Performance `MATRIX_SOURCE_USER_CC2` |
| **117** | User CC 3 | Source matrice Performance `MATRIX_SOURCE_USER_CC3` |
| **118** | User CC 4 | Source matrice Performance `MATRIX_SOURCE_USER_CC4` |
| **119** | Current Inst | Sélection de l'instrument affiché à l'écran (0-3) |
| **120** | All Sound Off | Coupe instantanément le son du timbre |
| **123** | All Notes Off | Relâche toutes les notes actives du timbre |
| **124** | Omni Off | Désactive le mode Omni |
| **125** | Omni On | Active le mode Omni |
| **127** | Reset All | Réinitialisation générale des contrôleurs |

---

### Engine et Modulation FM

Le PreenFM3 supporte 32 algorithmes FM à 6 opérateurs, 5 index de modulation (`IM1` à `IM5`), un retour (`Feedback` / `IM6`), ainsi que les contrôles de moteur de synthèse (Glide, Play Mode, Décimation).

| Paramètre | CC | Plage brute | Valeur interne firmware | Conversion |
|:---|:---:|:---:|:---|:---|
| **Glide Speed** | **5** | 0-127 | `0.0f` à `12.0f` | `valeur = CC * (12.0 / 127.0)` |
| **Algorithme** | **16** | 0-31 | `0.0f` à `31.0f` | Entier direct |
| **IM1** | **17** | 0-100 | `0.0f` à `10.0f` | `valeur = CC * 0.1` |
| **IM2** | **18** | 0-100 | `0.0f` à `10.0f` | `valeur = CC * 0.1` |
| **IM3** | **19** | 0-100 | `0.0f` à `10.0f` | `valeur = CC * 0.1` |
| **IM4** | **20** | 0-100 | `0.0f` à `10.0f` | `valeur = CC * 0.1` |
| **IM5** | **21** | 0-100 | `0.0f` à `10.0f` | `valeur = CC * 0.1` |
| **Feedback (IM6)** | **30** | 0-127 | `0.0f` à `1.0f` | `valeur = CC / 127.0` |
| **Engine Decimation** | **42** | 0-20 | 0 à 20 | Entier direct (0..18: 1bit..19bit, 19: Full, 20: HQ ; >= 21 borné à 20) |
| **Play Mode** | **43** | 0-127 | 0 à 2 | 0: Mono, 1: Poly, 2: Unison (`Unis`) |

> [!NOTE]
> **Pas de collision IM et Mix** : Contrairement à de vieilles documentations erronées qui prétendaient que l'algorithme était sur CC 20 et les IM sur 21-26, les index de modulation sont strictement sur les CC 16-21 et 30. Le mixage commence sur le CC 22 sans aucun chevauchement.

---

### Mix et Pan des Opérateurs

Les sorties directes des opérateurs 1 à 6 vers le bus de mixage sont contrôlées par un ensemble de CC dédiés. Pour les opérateurs 1 à 4, un **pattern entrelacé** est utilisé (CC pairs = niveau de mixage, CC impairs = panoramique). Pour les opérateurs 5 et 6, les CC 31, 36, 37 et 39 sont utilisés (le CC 38 étant scrupuleusement réservé au protocole standard MIDI NRPN Data Entry LSB).

| Paramètre | CC | Plage brute | Valeur interne | Formule |
|:---|:---:|:---:|:---|:---|
| **Mix OP1** | **22** | 0-127 | `0.0` à `1.0` | `valeur = CC * 0.007874` |
| **Pan OP1** | **23** | 0-127 | `-1.0` à `+1.0` | `valeur = (CC * 0.007874) * 2.0 - 1.0` (64 = centre) |
| **Mix OP2** | **24** | 0-127 | `0.0` à `1.0` | `valeur = CC * 0.007874` |
| **Pan OP2** | **25** | 0-127 | `-1.0` à `+1.0` | `valeur = (CC * 0.007874) * 2.0 - 1.0` |
| **Mix OP3** | **26** | 0-127 | `0.0` à `1.0` | `valeur = CC * 0.007874` |
| **Pan OP3** | **27** | 0-127 | `-1.0` à `+1.0` | `valeur = (CC * 0.007874) * 2.0 - 1.0` |
| **Mix OP4** | **28** | 0-127 | `0.0` à `1.0` | `valeur = CC * 0.007874` |
| **Pan OP4** | **29** | 0-127 | `-1.0` à `+1.0` | `valeur = (CC * 0.007874) * 2.0 - 1.0` |
| **Mix OP5** | **31** | 0-127 | `0.0` à `1.0` | `valeur = CC * 0.007874` |
| **Pan OP5** | **36** | 0-127 | `-1.0` à `+1.0` | `valeur = (CC * 0.007874) * 2.0 - 1.0` |
| **Mix OP6** | **37** | 0-127 | `0.0` à `1.0` | `valeur = CC * 0.007874` |
| **Pan OP6** | **39** | 0-127 | `-1.0` à `+1.0` | `valeur = (CC * 0.007874) * 2.0 - 1.0` |

> [!NOTE]
> **Pourquoi le saut du CC 38 ?**  
> Dans la norme MIDI 1.0, le **CC 38** est universellement assigné au *Data Entry LSB* indispensable au protocole **NRPN**. L'assignation de OP5 et OP6 évite donc soigneusement le CC 38 pour préserver l'intégrité absolue des messages NRPN.


---

### Fréquences des Opérateurs

Les ratios de fréquence harmonique des 6 opérateurs sont accessibles en continu par les CC 50 à 55.

| Opérateur | CC | Plage brute | Ratio harmonique | Formule |
|:---|:---:|:---:|:---|:---|
| **Freq OP1** | **50** | 0-127 | 0.0 à 10.58 | `ratio = CC * (1/12)` |
| **Freq OP2** | **51** | 0-127 | 0.0 à 10.58 | `ratio = CC * (1/12)` |
| **Freq OP3** | **52** | 0-127 | 0.0 à 10.58 | `ratio = CC * (1/12)` |
| **Freq OP4** | **53** | 0-127 | 0.0 à 10.58 | `ratio = CC * (1/12)` |
| **Freq OP5** | **54** | 0-127 | 0.0 à 10.58 | `ratio = CC * (1/12)` |
| **Freq OP6** | **55** | 0-127 | 0.0 à 10.58 | `ratio = CC * (1/12)` |

*Exemples de ratios types* :
- CC = 0 → 0.00 (sub/LFO)
- CC = 12 → 1.00 (fondamentale)
- CC = 24 → 2.00 (octave 1)
- CC = 36 → 3.00 (quinte au-dessus de l'octave 1)
- CC = 48 → 4.00 (double octave)

---

### Warp des Opérateurs

Le paramètre `Warp` modifie la fonction de déformation de phase de l'opérateur (asymétrie de forme d'onde).

| Opérateur | CC | Plage brute | Valeur interne | Formule |
|:---|:---:|:---:|:---|:---|
| **Warp OP1** | **33** | 0-127 | -4.0 à +4.0 | `valeur = CC * (8.0 / 127.0) - 4.0` |
| **Warp OP2** | **34** | 0-127 | -4.0 à +4.0 | `valeur = CC * (8.0 / 127.0) - 4.0` |
| **Warp OP3** | **35** | 0-127 | -4.0 à +4.0 | `valeur = CC * (8.0 / 127.0) - 4.0` |
| **Warp OP4** | **111** | 0-127 | -4.0 à +4.0 | `valeur = CC * (8.0 / 127.0) - 4.0` |
| **Warp OP5** | **112** | 0-127 | -4.0 à +4.0 | `valeur = CC * (8.0 / 127.0) - 4.0` |
| **Warp OP6** | **113** | 0-127 | -4.0 à +4.0 | `valeur = CC * (8.0 / 127.0) - 4.0` |

> [!IMPORTANT]
> **Pourquoi cette séparation 33-35 et 111-113 ?**  
> Historiquement sur le PreenFM2, OP1-3 utilisaient les CC 97, 98 et 99. Mais ces numéros sont normalisés par le standard MIDI pour le protocole NRPN (CC 98 = NRPN LSB, CC 99 = NRPN MSB, CC 97 = Data Decrement). Lors du portage PreenFM3, Xavier Hosxe a relogé OP1-3 sur les CC 33-35 libres, tandis que OP4-6 sont restés sur 111-113.

---

### Phase des Opérateurs

> [!CAUTION]
> **Correction majeure de documentation** :  
> Certaines documentations antérieures indiquaient que la phase des opérateurs OP1-6 était contrôlée par les CC 62 à 67. **C'est absolument faux**.  
> Dans le firmware, les CC 62-67 sont câblés sur :
> - CC 62 : Attaque globale de tous les modulateurs
> - CC 63 : Relâchement global de tous les modulateurs
> - CC 64 : Pédale de Sustain (`Hold Pedal`)
> - CC 65 : Attaque de l'opérateur 1
> - CC 66 : Type du Filtre 2
> - CC 67 : Fréquence / Cutoff du Filtre 2  
> Envoyer des CC 62-67 en croyant changer la phase envoyait donc des ordres de sustain et détruisait les réglages de filtre et d'enveloppe !

La phase de départ des oscillateurs est gérée **exclusivement via NRPN** haute fidélité (`ROW_OP_PHASE1..6`, encodeur 0 `ENCODER_OSC_PHASE`).  
Voir la section [Phase des Opérateurs (Détail NRPN)](#phase-des-opérateurs-détail-nrpn) plus bas pour les détails complets.

---

### Filtres / Effets 1 & 2

Le PreenFM3 dispose de deux étages de filtrage/effets stéréo indépendants par timbre (`ROW_EFFECT1` et `ROW_EFFECT2`).

#### Filtre 1 (`ROW_EFFECT1`)

| Paramètre | CC | Plage brute | Description |
|:---|:---:|:---:|:---|
| **Type** | **70** | 0-n | 0: Off, 1: 12dB LowPass, 2: 24dB LowPass, 3: HighPass, 4: BandPass, etc. |
| **Param 1 (Cutoff)** | **71** | 0-127 | Fréquence de coupure (`0.0` à `1.0`) |
| **Param 2 (Resonance)** | **72** | 0-127 | Résonance (`0.0` à `1.0`) |
| **Gain** | **73** | 0-127 | Gain post-filtre (`0.0` à `1.27`) |

#### Filtre 2 (`ROW_EFFECT2`)

| Paramètre | CC | Plage brute | Description |
|:---|:---:|:---:|:---|
| **Type** | **66** | 0-n | Type du second filtre / effet |
| **Param 1 (Cutoff)** | **67** | 0-127 | Fréquence de coupure (`0.0` à `1.0`) |
| **Param 2 (Resonance)** | **68** | 0-127 | Résonance (`0.0` à `1.0`) |
| **Mix** | **69** | 0-127 | Mix Dry/Wet (`0.0` à `1.27`, 100 = 100% Wet) |

---

### Enveloppes des Opérateurs

Les temps d'attaque et de relâchement peuvent être modulés en temps réel individuellement ou par groupe fonctionnel (toutes porteuses / tous modulateurs).

| Paramètre | CC | Plage brute | Échelle physique | Note firmware |
|:---|:---:|:---:|:---|:---|
| **Atk All Modulators** | **62** | 0-127 | 0-2s | Appliqué dynamiquement aux modulateurs de l'algo |
| **Rel All Modulators** | **63** | 0-127 | 0-4s | Appliqué dynamiquement aux modulateurs de l'algo |
| **Hold Pedal** | **64** | 0-127 | On/Off | Pédale Sustain standard (valeur >= 64 active) |
| **Atk OP1** | **65** | 0-127 | 0-2s | `valeur = CC * 0.015625` (séparé des autres OP) |
| **Atk OP2** | **75** | 0-127 | 0-2s | `valeur = CC * 0.015625` |
| **Atk OP3** | **76** | 0-127 | 0-2s | `valeur = CC * 0.015625` |
| **Atk OP4** | **77** | 0-127 | 0-2s | `valeur = CC * 0.015625` |
| **Atk OP5** | **78** | 0-127 | 0-2s | `valeur = CC * 0.015625` |
| **Atk OP6** | **79** | 0-127 | 0-2s | `valeur = CC * 0.015625` |
| **Atk All Carriers** | **80** | 0-127 | 0-2s | Appliqué dynamiquement aux porteuses de l'algo |
| **Rel All Carriers** | **81** | 0-127 | 0-4s | Appliqué dynamiquement aux porteuses de l'algo |
| **Rel OP1** | **82** | 0-127 | 0-4s | `valeur = CC * 0.03125` |
| **Rel OP2** | **83** | 0-127 | 0-4s | `valeur = CC * 0.03125` |
| **Rel OP3** | **84** | 0-127 | 0-4s | `valeur = CC * 0.03125` |
| **Rel OP4** | **85** | 0-127 | 0-4s | `valeur = CC * 0.03125` |
| **Rel OP5** | **86** | 0-127 | 0-4s | `valeur = CC * 0.03125` |
| **Rel OP6** | **87** | 0-127 | 0-4s | `valeur = CC * 0.03125` |

---

### LFOs et Enveloppes Libres

| Paramètre | CC | Plage brute | Valeur / Échelle |
|:---|:---:|:---:|:---|
| **LFO1 Freq** | **56** | 0-127 | `0.0` à `25.4 Hz` (`valeur = CC * 0.2`) |
| **LFO2 Freq** | **57** | 0-127 | `0.0` à `25.4 Hz` |
| **LFO3 Freq** | **58** | 0-127 | `0.0` à `25.4 Hz` |
| **LFO Env2 Silence** | **59** | 0-127 | `valeur = CC * 0.125` (0 à 15.8 secondes) |
| **LFO1 Phase** | **88** | 0-127 | `-4.0` à `+1.0` (`valeur = -4.0 + CC * (5.0 / 127.0)`) |
| **LFO2 Phase** | **89** | 0-127 | `-4.0` à `+1.0` |
| **LFO3 Phase** | **90** | 0-127 | `-4.0` à `+1.0` |
| **LFO1 Bias** | **91** | 0-127 | `0.0` à `1.27` (`valeur = CC * 0.01`) |
| **LFO2 Bias** | **92** | 0-127 | `0.0` à `1.27` |
| **LFO3 Bias** | **93** | 0-127 | `0.0` à `1.27` |
| **LFO1 Shape** | **94** | 0-7 | 0: Sin, 1: Saw, 2: Tri, 3: Sqr, 4: Rand, 5: Brown, 6: Wand, 7: Flow |
| **LFO2 Shape** | **95** | 0-7 | Idem |
| **LFO3 Shape** | **96** | 0-7 | Idem |

> [!NOTE]
> Les **Step Sequencers 1 & 2** (`BPM`, `Gate`, valeurs, modes de pas et longueur de boucle) n'utilisent plus de CC dédiés (les anciens CC 60 et 61 ont été retirés) et sont contrôlés **exclusivement via NRPN** (voir [Step Sequencers](#step-sequencers)).

---

### Mixeur, Profils de Dynamique, Reverb Dry/Wet & Master FX (CC 7, 10, 11, 40, 41, 44, 45)

Les paramètres de mixage, de dynamique et d'effets globaux sont accessibles en temps réel par CC :

| Paramètre | CC | Plage brute | Valeur interne | Description |
|:---|:---:|:---:|:---|:---|
| **Mixer Volume** | **7** | 0-127 | `0.0` à `1.0` | Volume principal du timbre courant |
| **Mixer Pan** | **10** | 0-127 | `-63` à `+64` | Panoramique stéréo du timbre courant |
| **Mixer Send (Legacy)** | **11** | 0-127 | `0.0` à `1.0` | Envoi Master Reverb (doublon rétrocompatible du CC 40) |
| **Timbre Dry/Wet** | **40** | 0-127 | `0.0` à `1.0` | Reverb Dry/Wet du timbre courant (`send = CC / 127.0`) |
| **Timbre Dynamics** | **41** | 0-127 | 0 à 6 | Profil compresseur/saturation du timbre (0: Off, 1: Glue, 2: Punch, 3: Tube, 4: Limit, 5: Drive, 6: Fuzz) |
| **MFX Return Level** | **44** | 0-127 | `0.0` à `1.0` | Niveau global de retour Master Reverb (`reverbLevel_`) |
| **MFX Preset** | **45** | 0-18 | 0 à 18 | Numéro de preset de réverbération Master (`reverbPreset_`) |

- **CC 40 (`CC_TIMBRE_DRYWET`)** : Règle le **Reverb Dry/Wet** du timbre correspondant au canal MIDI reçu (`0.0` à `1.0`).
  - Chaque timbre possédant son propre canal MIDI (Ch 1 à 6), l'assignation sur le **CC 40** contrôle le Dry/Wet du timbre ciblé de manière claire et universelle sans duplication.
  - **CC 11** (`CC_MIXER_SEND`) reste supporté pour la rétrocompatibilité complète avec les setups existants.
- **CC 41 (`CC_TIMBRE_DYNAMICS`)** : Sélectionne le profil de traitement dynamique du timbre (0: Off, 1: Glue, 2: Punch, 3: Tube, 4: Limit, 5: Drive, 6: Fuzz).
  - Décodage intelligent : accepte directement l'entier du profil (0 à 6) ou une valeur d'automation continue standard 0-127 (`valeur = (CC < 7) ? CC : (CC * 7 / 128)`).
  - Pris en charge nativement dans `Synth::setNewMixerValueFromMidi` (`MIXER_VALUE_COMPRESSOR`) avec mise à jour immédiate de l'écran TFT via `propagateNewMixerValueFromExternal`.
- **CC 44 (`CC_MFX_RETURN`)** : Règle le niveau général de retour Master Reverb (`reverbLevel_`, `0.0` à `1.0`).
- **CC 45 (`CC_MFX_PRESET`)** : Sélectionne le preset de réverbération Master (`reverbPreset_`, 0 à 18).
- **Émission physique temps réel (`MidiDecoder::newMixerValue`)** : Lorsque l'utilisateur tourne les encodeurs sur l'écran Mixer du PreenFM3 :
  - En mode **`MIDI Sends = CC`** : émet **CC 7** (Volume), **CC 10** (Pan), **CC 40** (Dry/Wet), **CC 41** (Dynamics, mis à l'échelle `0..127`), **CC 44** (MFX Return) et **CC 45** (MFX Preset).
  - En mode **`MIDI Sends = NRPN`** : émet les **NRPN `512..515`** (`MSB = 4, LSB = 0..3`) pour Dry/Wet, Dynamics, MFX Return et MFX Preset (et conserve **CC 7** / **CC 10** pour Volume / Pan).
- **Synchronisation au dump de patch** : lors d'un dump NRPN (`sendCurrentPatchAsNrpns`), ces 4 paramètres sont également émis via les **NRPN `512..515`** (voir [Timbre & Master FX (NRPN 512-515)](#timbre--master-fx-nrpn-512-515)).


---

### Performance, Matrice & Unison

| Paramètre | CC | Plage brute | Valeur interne |
|:---|:---:|:---:|:---|
| **Matrix Row 1 Mul** | **46** | 0-127 | `-10.0` à `+15.4` (`valeur = CC * 0.2 - 10.0`) |
| **Matrix Row 2 Mul** | **47** | 0-127 | `-10.0` à `+15.4` |
| **Matrix Row 3 Mul** | **48** | 0-127 | `-10.0` à `+15.4` |
| **Matrix Row 4 Mul** | **49** | 0-127 | `-10.0` à `+15.4` |
| **User CC 1 (Perf 1)** | **115** | 0-127 | `-1.0` à `+1.0` (Source matrice `MATRIX_SOURCE_USER_CC1`) |
| **User CC 2 (Perf 2)** | **116** | 0-127 | `-1.0` à `+1.0` (Source matrice `MATRIX_SOURCE_USER_CC2`) |
| **User CC 3 (Perf 3)** | **117** | 0-127 | `-1.0` à `+1.0` (Source matrice `MATRIX_SOURCE_USER_CC3`) |
| **User CC 4 (Perf 4)** | **118** | 0-127 | `-1.0` à `+1.0` (Source matrice `MATRIX_SOURCE_USER_CC4`) |
| **Unison Detune** | **13** | 0-127 | `-1.0` à `+1.0` (`valeur = CC * (1/64) - 1.0`) |
| **Unison Spread** | **14** | 0-127 | `0.0` à `1.0` (`valeur = CC / 127.0`) |
| **Current Instrument** | **119** | 0-3 | Sélectionne l'instrument affiché sur le TFT |

---

### Arpeggiateur et Séquenceur

| Paramètre | CC | Plage brute | Description |
|:---|:---:|:---:|:---|
| **Arp Clock** | **100** | 0-1 | Synchronisation interne ou MIDI Clock |
| **Arp Direction** | **101** | 0-3 | 0: Up, 1: Down, 2: UpDown, 3: Random |
| **Arp Octave** | **102** | 0-3 | 1, 2, 3 ou 4 octaves |
| **Arp Pattern** | **103** | 0-15 | Numéro de motif d'arpège |
| **Arp Division** | **104** | 0-n | Division temporelle (1/4, 1/8, 1/16...) |
| **Arp Duration** | **105** | 0-n | Longueur de note |
| **Seq Start All** | **106** | 0-1 | Démarre/arrête les séquenceurs de tous les timbres |
| **Seq Start Inst** | **107** | 0-1 | Démarre/arrête le séquenceur du timbre |
| **Seq Record Inst**| **108** | 0-1 | Arme l'enregistrement de séquence |
| **Seq Sequence** | **109** | 0-n | Charge le numéro de séquence |
| **Seq Transpose** | **110** | 0-127 | Transposition temps réel du séquenceur |

---

## NRPN (Non-Registered Parameter Numbers)

Les messages NRPN permettent d'éditer avec une résolution de **14 bits (0-16383)** n'importe quel paramètre interne du synthétiseur.

### Structure des messages NRPN

Un message NRPN complet nécessite l'envoi de 4 Control Changes consécutifs sur le canal du timbre :

```
CC 99 (0x63) = Parameter MSB (0-127)  ->  (midiIndex >> 7)
CC 98 (0x62) = Parameter LSB (0-127)  ->  (midiIndex & 0x7F)
CC  6 (0x06) = Data Value MSB (0-127) ->  (valeur >> 7)
CC 38 (0x26) = Data Value LSB (0-127) ->  (valeur & 0x7F)
```

**Reconstitution côté firmware / éditeur** :
```typescript
const midiIndex = (paramMSB << 7) | paramLSB;
const rawValue  = (valueMSB << 7) | valueLSB;
```

---

### Commandes spéciales NRPN

| Commande | paramMSB | paramLSB | valueMSB | valueLSB | Description |
|:---|:---:|:---:|:---:|:---:|:---|
| **Patch Dump Request** | **127** | **127** | 0 | `timbre` (0-3) | Demande le dump complet du patch via ~300 NRPN |
| **Preset Name Char** | **1** | **100-111** | 0 | Code ASCII | Modifie un des 12 caractères du nom du preset |

---

### Note Curves

Les courbes de pitch/vélocité par note (`ROW_MIDINOTE1CURVE` et `ROW_MIDINOTE2CURVE`) sont localisées aux indices mémoire 50 et 51 :

- **MIDINOTE1CURVE** : Index absolu `200` (`50 * 4`)
  - Before Type : `index = 200` → **paramMSB = 1, paramLSB = 72** (`200 & 0x7F`)
  - Break Note  : `index = 201` → **paramMSB = 1, paramLSB = 73**
  - After Type  : `index = 202` → **paramMSB = 1, paramLSB = 74**
- **MIDINOTE2CURVE** : Index absolu `204` (`51 * 4`)
  - Before Type : `index = 204` → **paramMSB = 1, paramLSB = 76**
  - Break Note  : `index = 205` → **paramMSB = 1, paramLSB = 77**
  - After Type  : `index = 206` → **paramMSB = 1, paramLSB = 78**

> [!NOTE]
> **Résolution du mystère "MSB différents"** :  
> Une légende dans certains codes d'éditeurs Web affirmait que les Note Curves nécessitaient `MSB=0` en lecture et `MSB=1` en écriture.  
> **Explication** : C'était un artefact d'un bug de routage historique dans `MidiDecoder.cpp` où la condition du Step Sequencer (`else if (paramMSB < 4)`) interceptait tous les messages avec `paramMSB >= 2`.  
> En réalité, `midiIndex` vaut 200 à 206, ce qui donne mathématiquement `200 >> 7 = 1` et `200 & 0x7F = 72`.  
> **La lecture ET l'écriture utilisent toutes deux `paramMSB = 1` et `paramLSB = 72..78`**.

---

### Phase des Opérateurs (Détail NRPN)

La phase des oscillateurs (`ROW_OP_PHASE1..6`, encodeur 0) se règle de **0 à 360°** :

| Opérateur | Ligne interne | Index mémoire | paramMSB | paramLSB | Plage NRPN |
|:---:|:---:|:---:|:---:|:---:|:---:|
| **OP1** | `ROW_OP_PHASE1` | **248** | **1** | **120** | 0 à 360 |
| **OP2** | `ROW_OP_PHASE2` | **252** | **1** | **124** | 0 à 360 |
| **OP3** | `ROW_OP_PHASE3` | **256** | **2** | **0** | 0 à 360 |
| **OP4** | `ROW_OP_PHASE4` | **260** | **2** | **4** | 0 à 360 |
| **OP5** | `ROW_OP_PHASE5` | **264** | **2** | **8** | 0 à 360 |
| **OP6** | `ROW_OP_PHASE6` | **268** | **2** | **12** | 0 à 360 |

#### Encodage des valeurs de Phase :
Le paramètre de phase a pour type d'affichage `DISPLAY_TYPE_INT` (entier direct).  
La valeur transmise en NRPN est donc **directement l'angle en degrés (0 à 360)**, et **NON PAS un float multiplié par 100** :
```typescript
// Envoi vers le PreenFM3 :
const valueToSend = degrees; // ex: 180
const valueMSB    = (valueToSend >> 7) & 0x7F; // 180 >> 7 = 1
const valueLSB    = valueToSend & 0x7F;        // 180 & 0x7F = 52
```

> [!TIP]
> **Pourquoi OP3-OP6 étaient bloqués auparavant ?**  
> OP3 a un index de 256 (`paramMSB = 2`). Auparavant, le firmware considérait que tout message avec `paramMSB == 2 || paramMSB == 3` était destiné aux pas du Step Sequencer.  
> Le correctif firmware restreint désormais le Step Sequencer à `(paramMSB == 2 || paramMSB == 3) && paramLSB < 16`. Les paramètres de phase d'OP3, OP4, OP5 et OP6 fonctionnent maintenant parfaitement dans les deux sens !

---

### Step Sequencers

Les Step Sequencers 1 & 2 sont contrôlés **exclusivement via NRPN** (aucun CC dédié) :

1. **Paramètres globaux (`BPM` et `Gate`)** : utilisent le mapping NRPN standard de `ROW_LFOSEQ1` / `ROW_LFOSEQ2` (`encodeur 0` = `BPM`, `encodeur 1` = `Gate`).
   - Plage `BPM` (`10..246`) : `10..240` = BPM interne (`Int`), `241..245` = MIDI Clock (`Ext` : `Ck/4`, `Ck/2`, `Ck  `, `Ck*2`, `Ck*4`), `246` = `Note` (`LFO_SEQ_STEP_ON_NOTE`, avance d'un pas à chaque `NoteOn`).
2. **Valeurs des pas (`paramMSB = 2` ou `3`)** :
   - **Step Sequencer 1** : `paramMSB = 2`, `paramLSB = 0..15` (Step 1 à 16)
   - **Step Sequencer 2** : `paramMSB = 3`, `paramLSB = 0..15` (Step 1 à 16)
   - `valueLSB = 0..15` : hauteur / valeur du pas (`steps[step] & 0x0F`).
3. **Modes des pas et longueur de boucle (`paramMSB = 5` ou `6`)** :
   - **Step Sequencer 1** : `paramMSB = 5`
   - **Step Sequencer 2** : `paramMSB = 6`

| `paramLSB` | Fonction | `valueLSB` | Description |
|:---:|:---|:---:|:---|
| **0..15** | Mode du pas 1 à 16 | **0..6** | `0`: `Norm`, `1`: `Gld1`, `2`: `Gld2`, `3`: `Gld3`, `4`: `Mute`, `5`: `Pass` (*step skip*), `6`: `Rset` (*loop reset*) |
| **16** | Loop Length (Last Step) | **0..16** | `1..16` place `Rset` sur le pas `length - 1` et remet les autres `Rset` à `Norm` ; `0` efface tous les `Rset` |

- **Sortie linéaire & compatibilité `Note+` / Scala / `Osc Freq`** : la sortie d'un Step Sequencer est linéaire (`stepVal / 12.0`, soit `0.0` à `1.25`, avec `12 = 1.0`), ce qui permet de piloter `Note+` (`MTX_DEST_NOTE_ADD`) directement en degrés de la gamme Scala active (ou en demi-tons) avec un multiplicateur `1.0`. Lorsque la matrice route `StepSeq 1/2` vers `OSC1_FREQ..ALL_OSC_FREQ`, le firmware convertit automatiquement en `(2^src - 1) * mul` pour préserver la justesse des anciens patches.
- **Dump & MIDI Out bidirectionnel** : `sendCurrentPatchAsNrpns` émet à la fois les valeurs (`MSB = 2/3`) et les modes (`MSB = 5/6`) des 16 pas. En mode `MIDI Sends = NRPN`, l'édition de la valeur ou du mode (`ENCODER_STEPSEQ_GLIDE`) sur le synthé émet le NRPN correspondant.
- **Zéro collision** : les modes et longueurs de boucle sont isolés sur `paramMSB = 5` et `6` afin de ne pas entrer en conflit avec les paramètres de synthèse mappés sur `paramMSB = 2` (`LSB >= 16`).

---

### Timbre & Master FX (NRPN 512-515)

Les réglages de mixage FX et dynamique par timbre/global (non contenus dans `OneSynthParams`) disposent d'une plage NRPN dédiée sous **`paramMSB = 4`** (`index = 512..515`), transmise automatiquement à la fin de chaque dump de patch (`sendCurrentPatchAsNrpns`), décodée dans `decodeNrpn`, et émise en temps réel par `newMixerValue` en mode `MIDI Sends = NRPN` :

| Paramètre | Index NRPN | `paramMSB` (CC 99) | `paramLSB` (CC 98) | Plage valeur NRPN | Description / Équivalent CC |
|:---|:---:|:---:|:---:|:---:|:---|
| **`TIMBRE_DRYWET`** | **512** | **4** | **0** | **0 à 100** | Reverb Dry/Wet du timbre (`0.00` à `1.00`, en centièmes) — CC 40 |
| **`TIMBRE_DYNAMICS`** | **513** | **4** | **1** | **0 à 6** | Profil dynamique (`0`: Off, `1`: Glue, `2`: Punch, `3`: Tube, `4`: Limit, `5`: Drive, `6`: Fuzz) — CC 41 |
| **`MFX_RETURN`** | **514** | **4** | **2** | **0 à 100** | Niveau global de retour Master Reverb (`0.00` à `1.00`, en centièmes) — CC 44 |
| **`MFX_PRESET`** | **515** | **4** | **3** | **0 à 18** | Preset de réverbération Master (`reverbPreset_`) — CC 45 |

> [!NOTE]
> **Pourquoi `paramMSB = 4` ?**  
> L'espace `paramMSB = 4` (`512..515`) est totalement isolé des paramètres de synthèse (`0..275`), du nom de preset (`228..239`), des courbes d'enveloppes (`300..323`) et du Step Sequencer (`paramMSB = 2..3, LSB = 0..15` et `paramMSB = 5..6, LSB = 0..16`), garantissant zéro collision lors des dumps et éditions bidirectionnelles. Les CC 40, 41, 44 et 45 restent également actifs en réception dans `controlChange`.

---

### Algorithme de transformation mémoire ↔ MIDI

Pour préserver la compatibilité ascendante avec les patches et éditeurs du PreenFM2, le firmware applique une permutation d'indices dans `MidiDecoder.cpp` :

```cpp
int MidiDecoder::getMidiIndexFromMemory(int index) {
    int paramRow = index >> 2;
    int encoder  = index % 4;

    switch (paramRow) {
    case ROW_LFOPHASES:
        paramRow += 4; // Décalé après ROW_LFOSEQ2
        break;
    case ROW_LFOENV1:
    case ROW_LFOENV2:
    case ROW_LFOSEQ1:
    case ROW_LFOSEQ2:
        paramRow -= 1; // Décalé avant ROW_LFOPHASES
        break;
    // Entrelacement Time et Level (fusion décembre 2022)
    case ROW_ENV1_TIME ... ROW_ENV6_TIME:
        paramRow = ROW_ENV1_TIME + (paramRow - ROW_ENV1_TIME) * 2;
        encoder *= 2;
        break;
    case ROW_ENV1_LEVEL ... ROW_ENV6_LEVEL:
        paramRow = ROW_ENV1_TIME + (paramRow - ROW_ENV1_LEVEL) * 2;
        encoder = encoder * 2 + 1;
        break;
    }
    return paramRow * 4 + encoder;
}
```

---

### Scalings des paramètres

Selon le `displayType` du paramètre (`FMDisplayEditor.cpp`), l'encodage de la valeur NRPN diffère :

```typescript
// 1. Paramètres FLOAT (Temps d'enveloppe, fréquences LFO, ratios) :
// Firmware envoie (valeur - minValue) * 100.0f
const realFloatValue = (nrpnValue / 100.0) + paramMinValue;

// 2. Paramètres INT (Algorithme, formes d'onde, Phase des opérateurs) :
// Firmware envoie directement l'entier brut
const realIntValue = nrpnValue;

// 3. Fine Tune : Centré sur 1600 (±16 demi-tons)
const semitones = (nrpnValue - 1600) / 100.0;
```

---

## LFO MIDI Clock Mode

Quand la fréquence d'un LFO est synchronisée avec l'horloge MIDI, la valeur brute NRPN passe dans une plage spécifique au-delà de 10 000 :

| Plage brute NRPN | Mode de synchronisation | Répétition |
|:---:|:---|:---|
| **0 - 9990** | Fréquence libre | 0.00 à 99.90 Hz (`valeur / 100`) |
| **10000** | MIDI Clock divisé par 16 | `MC / 16` |
| **10010** | MIDI Clock divisé par 8 | `MC / 8` |
| **10020** | MIDI Clock divisé par 4 | `MC / 4` |
| **10030** | MIDI Clock divisé par 2 | `MC / 2` |
| **10040** | MIDI Clock direct 1:1 | `MC` (1 mesure de 24 ticks) |
| **10050** | MIDI Clock multiplié par 2 | `MC * 2` |
| **10060** | MIDI Clock multiplié par 3 | `MC * 3` |
| **10070** | MIDI Clock multiplié par 4 | `MC * 4` |
| **10080** | MIDI Clock multiplié par 8 | `MC * 8` |

---

## Références firmware

- `firmware/Src/midi/MidiDecoder.h` : Déclaration de l'enum `AllControlChange` et signatures.
- `firmware/Src/midi/MidiDecoder.cpp` : Moteur de décodage des CC et machine d'état NRPN.
- `firmware/Src/synth/Common.h` : Numérotation des lignes de paramètres (`ROW_`).
- `firmware/Src/synth/SynthState.h` : Définition des encodeurs par ligne (`ENCODER_`).
- `firmware/Src/hardware/FMDisplayEditor.cpp` : Définition des plages min/max et des types d'affichage de chaque paramètre.
