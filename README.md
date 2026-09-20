# Wyrdcry Warband Deck

Die eigene [Wyrdcry](https://wyrdcry.net)-Bande als Kartendeck auf dem Handy.
Bande aus dem Warband Builder exportieren, hier importieren, durch die Kämpfer
wischen.

Inoffizielles Fanprojekt. Keine Verbindung zu den Autor:innen von Wyrdcry oder
zu Games Workshop.

**Status: früh.** Die App zeigt an, sie bearbeitet nicht.

## Was sie kann

- Warband-JSON aus dem Builder importieren
- Kämpfer als Karten anzeigen, horizontal durchwischen
- Exportieren über das System-Share-Sheet, wahlweise als aktueller Stand oder
  als datierter Schnappschuss
- Beim Import warnen, wenn die Datei älter ist als der gespeicherte Stand

## Daten

Alles liegt in IndexedDB, auf genau diesem Gerät. Kein Konto, kein Server, kein
Sync. Was nicht exportiert wurde, ist nach einer Deinstallation weg.

Die App auf den Home-Bildschirm zu legen ist kein Komfort, sondern
Voraussetzung: Safari löscht die Daten nicht installierter Seiten nach sieben
Tagen ohne Nutzung.

## Entwicklung

Node 20 oder neuer.

```sh
npm install
npm run sync:data     # Spieldaten aus dem Site-Repo kopieren
npm run dev
```

`npm run sync:data` erwartet das Repo [`jomblr/wyrdcry`](https://github.com/jomblr/wyrdcry)
als Nachbarordner. Liegt es woanders:

```sh
npm run sync:data -- --from /pfad/zu/wyrdcry/src/data
```

Die Spieldaten sind **nicht** Teil dieses Repos. Sie gehören zum
Wyrdcry-Projekt, dessen Lizenz derzeit ungeklärt ist; `src/lib/data/*.json` ist
deshalb gitignored.

| Befehl | Zweck |
| --- | --- |
| `npm run dev` | Entwicklungsserver |
| `npm run build` | statische Seite nach `build/` |
| `npm run check` | Typecheck |
| `npm run sync:data` | Spieldaten kopieren |

## Verwandte Projekte

- [`jomblr/wyrdcry`](https://github.com/jomblr/wyrdcry) – Regelwerk-Site und Warband Builder, Quelle der Daten
- `wyrdcry-card-creator` – Karten zum Ausdrucken; von dort kommt die Gestaltung
