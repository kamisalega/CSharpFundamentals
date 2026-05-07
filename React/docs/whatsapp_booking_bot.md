# Brief mission – WhatsApp Flow Booking Bot

## Domain Storytelling #1

┌─────────────────────────────────────────────────────────────────┐
│ HISTORIA: Rezerwacja przez WhatsApp Flow (3 templates) │
│ AKTOR: Marie Dupont │
└─────────────────────────────────────────────────────────────────┘

[1] Klient ──── otwiera aplikację WhatsApp ──→ [Bot]
(czat z B&B)

[2] Bot ──── wyświetla TEMPLATE 1: Welcome Menu ──→ [Klient]
(List Picker z 4 opcjami)

[3] Klient ──── wybiera "Réserver une chambre" ──→ [Bot]

[4] Bot ──── otwiera TEMPLATE 2: Date Picker Flow ──→ [Klient]
(2 pola: arrivée / départ)

[5] Klient ──── wybiera daty 12.08 → 15.08 ──→ [Bot]
i klika "Continuer"

[6] Bot ──── otwiera TEMPLATE 3: Guests Picker Flow ──→ [Klient]
(steppery: adultes / enfants)

[7] Klient ──── ustawia 2 adultes, 0 enfants ──→ [Bot]
i klika "Rechercher"

[8] Bot ──── wysyła zapytanie ──→ [System PMS]
(dates + guests)

[9] System PMS ──── zwraca dostępne pokoje ──→ [Bot]

[10] Bot ──── wyświetla List Picker pokoi ──→ [Klient]
• Standard 95€
• Supérieure 120€
• Suite Junior 165€

[11] Klient ──── wybiera "Supérieure" ──→ [Bot]

[12] Bot ──── pokazuje Detail Card ──→ [Klient]
(1 grand lit, annulation 48h, 360€)

[13] Klient ──── potwierdza wybór ──→ [Bot]

[14] Bot ──── otwiera Form Flow ──→ [Klient]
(Nom, Email, Téléphone)

[15] Klient ──── wypełnia dane ──→ [Bot]

[16] Bot ──── proponuje petit-déjeuner (Toggle) ──→ [Klient]

[17] Klient ──── wybiera "Oui" ──→ [Bot]

[18] Bot ──── wyświetla Recap Screen ──→ [Klient]
(Total: 432€)

[19] Klient ──── potwierdza rezerwację ──→ [Bot]

[20] Bot ──── tworzy rezerwację ──→ [System PMS]

[21] System PMS ──── zwraca RES-2026-0812-4571 ──→ [Bot]

[22] Bot ──── generuje link Stripe ──→ [System Płatności]

[23] System Płatności ──── zwraca secure URL ──→ [Bot]

[24] Bot ──── wysyła CTA Button "Payer" ──→ [Klient]

[25] Klient ──── opłaca ──→ [System Płatności]

[26] System Płatności ──── webhook success ──→ [System PMS]

[27] System PMS ──── triggeruje email ──→ [System Email]

[28] System Email ──── wysyła potwierdzenie ──→ [Klient]

[29] Bot ──── wysyła final message ──→ [Klient]
"✅ Réservation confirmée"

---

### Konfiguracja Twilio

1. Votre Société → ouvre un compte → chez le BSP → (un jour)
2. Votre Société → signe un contrat → avec le BSP
3. Propriétaire du B&B → s'inscrit → sur votre plateforme
4. Propriétaire du B&B → clique sur → « Connecter WhatsApp » → sur votre plateformeÒ
5. Votre plateforme → redirige → vers la fenêtre du BSP → le Propriétaire du B&B
6. Propriétaire du B&B → confirme → son numéro → chez le BSP
7. BSP → déclare → le numéro → à Meta
8. Meta → approuve → le numéro → (via le BSP)
9. BSP → renvoie → une clé d'accès → à votre plateforme
10. Votre plateforme → crée → les modèles → via le BSP
11. Le bot → gère → les réservations → pour le Client du B&B
12. BSP → prélève → une commission → à Votre Société (par message)

---

## Fonctionnalités attendues

- Accueil automatique du client sur WhatsApp
- Réponse aux FAQ
- Collecte des informations de réservation
- Intégration avec moteur de réservation
- Présentation des offres
- Récapitulatif du séjour
- Collecte des données client
- Envoi du lien de paiement
- Confirmation automatique
- Possibilité de reprise par un humain

---

## Cas particuliers à gérer

- Aucune disponibilité
- Dates invalides
- Demande incomplète
- Modification en cours
- Incompréhension
- Indisponibilité API
- Échec de paiement
- Interruption de conversation
- Transfert vers humain
- Demandes spécifiques
- Risque de double réservation

  Przeanalizuj wszystko co juz jest gotowe. Przygotuj plan integracji Whatsapp Flow i Twillo dla projektu "React/01_hotel_whatsapp_bot". Integracja nie  
  wykorzystuje orchiestratora AI z projektu. Opieraj sie na wymaganiach z dokument "React/docs/whatsapp_booking_bot.md" . Przygotuj konfiguracje Twilio (mam
  skonfigurowane konto testowe) wedlug wymagan z dokumentu "React/docs/whatsapp_booking_bot.md". Wykorzystuj Dobre praktyki programowania dla React/Nextjs.
  Integracja ma byc budowana wedlug dobrych praktyk TDD (Testy integracyjne), Testy E2E. Architektura ma byc tak skonstruktowana zeby byla otwarta na potencjalne zmiany
