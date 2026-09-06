# 🗂️ OfficeHub

Eine schlanke Web-App, um das Büro zu organisieren – komplett in **einer HTML-Datei**, ohne Framework, ohne Build-Schritt. Läuft auf Desktop und Handy, installierbar als PWA, Daten lokal im Browser (optional Team-Sync über Supabase).

## Funktionen

- **✅ Aufgaben** – Zuständige, Fälligkeit, Priorität, wiederkehrende Aufgaben (täglich/wöchentlich/monatlich), Überfällig-Markierung
- **🛒 Einkaufslisten** – mehrere Listen, Mengen, Abhaken, Vorschläge aus der Einkaufshistorie
- **💶 Rechnungen aufteilen** – Ausgaben mit Zahler & Teilnehmerkreis, cent-genaue Aufteilung, Ausgleichsvorschläge („Wer zahlt wem wie viel"), Quitt-stellen mit Archiv
- **📅 Räume & Arbeitsplätze** – Meetingraum-Buchung mit Kollisionsprüfung, Serientermine, Tages- & Wochenansicht; Arbeitsplatz-Buchung pro Tag
- **🗺️ Interaktiver Lageplan** – Räume und Plätze per Drag & Drop anordnen, Größe ziehen, mehrere Etagen, eigenes Grundriss-Foto als Hintergrund, Buchen per Klick in den Plan
- **💡 Smart Office** – Shelly-Lampen schalten (Gen 1 & Gen 2+), Nuki-Türen öffnen/auf-/abschließen über die lokale Bridge-API (mehrere Türen)
- **🔄 Team-Sync (optional)** – Supabase-Projekt + Büro-Code eintragen, dann teilen alle Geräte Aufgaben, Listen und Buchungen (Anleitung + SQL in der App unter Übersicht → Team-Sync)
- **📱 PWA** – installierbar aufs Homescreen, offlinefähig; 🌙 Dark Mode; 💾 Backup-Export/-Import

## Starten

```bash
cd office-hub
python3 -m http.server 8741
# → http://localhost:8741
```

Oder `index.html` einfach direkt im Browser öffnen (PWA-Installation und Service Worker brauchen allerdings http/https, z. B. via `localhost`).

`mobile-test.html` zeigt die App in einem 390-px-iPhone-Rahmen für Layout-Tests.

## Technik

- Eine Datei (`index.html`), Vanilla JS, kein Build
- Persistenz: `localStorage` (`officehub.v1`), optional Sync über Supabase REST (Tabelle `office_kv`, Last-Write-Wins pro Datenbereich)
- Smart-Office-Befehle gehen als `fetch` mit `mode:'no-cors'` direkt an die Geräte-IPs im LAN – Statusrückmeldung ist daher optimistisch
- Hinweis: Bei HTTPS-Hosting blockiert der Browser die lokalen HTTP-Gerätebefehle (Mixed Content); lokal via `http://localhost` funktioniert alles

## Lokal im Büro (Shellys direkt per IP)

Die veröffentlichte Website läuft über HTTPS – Browser erlauben von dort keine Befehle an `http://192.168.…`, deshalb schaltet sie Lampen über die Shelly-Cloud (ca. 1 Sekunde pro Lampe, Limit 1 Anfrage/s).

Wird die App dagegen **per HTTP aus dem Büro-Netz** geladen, schaltet sie Lampen **direkt per IP** (sofort, parallel, ohne Limit) und weicht nur auf die Cloud aus, wenn ein Gerät lokal nicht erreichbar ist. Die IPs lernt die App automatisch aus der Shelly-Cloud.

Einrichtung auf einem Rechner, der im Büro-WLAN dauerhaft läuft (Mac, NAS, Raspberry Pi):

```bash
git clone https://github.com/christophgerhardt-del/office-hub.git
cd office-hub && sh start-local.sh
# → im Büro: http://<IP-des-Rechners>:8741  (Login wie gewohnt)
```

Von unterwegs weiterhin die Website nutzen. Beide Varianten teilen dieselben Daten (Supabase).
