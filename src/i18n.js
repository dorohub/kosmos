// Zweisprachigkeit (Deutsch / Englisch). Texte im Code sind deutsch und werden über t() übersetzt.
const KEY = 'kosmos.lang';

export const LANG = (() => {
  try {
    const q = new URLSearchParams(location.search).get('lang');
    if (q === 'de' || q === 'en') return q;
    const v = localStorage.getItem(KEY);
    if (v === 'de' || v === 'en') return v;
  } catch { /* ignorieren */ }
  return (navigator.language || 'de').toLowerCase().startsWith('de') ? 'de' : 'en';
})();

export const EN = LANG === 'en';
export const LOCALE = EN ? 'en-US' : 'de-DE';

export function setLang(l) {
  try { localStorage.setItem(KEY, l); } catch { /* ignorieren */ }
  const u = new URL(location.href);
  u.searchParams.delete('lang');
  location.href = u.toString();
}

const DICT = {
  // Oberfläche (index.html)
  'Universal-Navigator · v1.0': 'Universal Navigator · v1.0',
  'Ziel suchen – Andromeda, Saturn, Orionnebel …': 'Search – Andromeda, Saturn, Orion Nebula …',
  'Tour': 'Tour',
  'Geführte Tour (T)': 'Guided tour (T)',
  'Favoriten (B)': 'Favorites (B)',
  '8K-Screenshot (P)': '8K screenshot (P)',
  'Link zur aktuellen Ansicht kopieren': 'Copy link to this view',
  'Klang an/aus (M)': 'Sound on/off (M)',
  'Oberfläche ausblenden (U)': 'Hide interface (U)',
  'Oberfläche einblenden (U)': 'Show interface (U)',
  'Oberfläche einblenden · U': 'Show interface · U',
  'Vollbild (F)': 'Fullscreen (F)',
  'Einstellungen': 'Settings',
  'Steuerung & Hilfe (H)': 'Controls & help (H)',
  'MASSSTAB': 'SCALE',
  'Schließen': 'Close',
  'Anfliegen': 'Fly there',
  'Langsam umkreisen (O)': 'Slowly orbit (O)',
  'Als Favorit merken': 'Save as favorite',
  'ENTFERNUNG ERDE': 'DISTANCE EARTH',
  'SICHTFELD': 'FIELD OF VIEW',
  'LICHT UNTERWEGS': 'LIGHT TRAVEL',
  'ROTVERSCHIEBUNG': 'REDSHIFT',
  'GALAKT. KOORD.': 'GALACTIC COORD.',
  'GESCHWINDIGKEIT': 'SPEED',
  'Langsamer / rückwärts': 'Slower / backwards',
  'Zeit anhalten (Leertaste)': 'Pause time (space)',
  'Schneller': 'Faster',
  'Zurück zur Gegenwart': 'Back to the present',
  'JETZT': 'NOW',
  'Echtzeit': 'Real time',
  'Ausrichtung zurücksetzen (N)': 'Reset orientation (N)',
  'Hineinzoomen': 'Zoom in',
  'Herauszoomen': 'Zoom out',
  'Zur Erde zurück (Pos1)': 'Back to Earth (Home)',
  'Zurück': 'Back',
  'Pause': 'Pause',
  'Weiter': 'Next',
  'Tour beenden': 'End tour',
  'Universal-Navigator · Von der Erde bis zum Rand des beobachtbaren Universums': 'Universal Navigator · From Earth to the edge of the observable universe',
  'NAVIGATION STARTEN': 'START NAVIGATION',
  'Ziehen = drehen · Mausrad = zoomen · Rechte Maustaste = schwenken · WASD = fliegen': 'Drag = rotate · Wheel = zoom · Right mouse = pan · WASD = fly',
  'Sprache: English': 'Language: Deutsch',
  'Wischen = drehen · Zwei Finger = zoomen · Antippen = auswählen': 'Swipe = rotate · Two fingers = zoom · Tap = select',
  // HUD
  'Kein Objekt gefunden': 'No object found',
  'VON DER ERDE': 'FROM EARTH',
  'VON DIR': 'FROM YOU',
  'DURCHMESSER': 'DIAMETER',
  'Orbit-Modus <b>aktiv</b>': 'Orbit mode <b>on</b>',
  'Orbit-Modus aus': 'Orbit mode off',
  '<b>{n}</b> zu Favoriten hinzugefügt': '<b>{n}</b> added to favorites',
  '{n} entfernt': '{n} removed',
  'Oberfläche <b>eingeblendet</b>': 'Interface <b>shown</b>',
  'Klang <b>an</b>': 'Sound <b>on</b>',
  'Klang aus': 'Sound off',
  'Link zur Ansicht <b>kopiert</b>': 'Link to view <b>copied</b>',
  'ANSICHT TEILEN': 'SHARE VIEW',
  'Kopiere diesen Link:': 'Copy this link:',
  'Beschriftungen': 'Labels',
  'Namen von Objekten anzeigen (L)': 'Show object names (L)',
  'Sternbilder': 'Constellations',
  'Linien & Namen der 88 Sternbilder (K)': 'Lines & names of the 88 constellations (K)',
  'Umlaufbahnen': 'Orbits',
  'Planeten- und Mondbahnen einblenden': 'Show planet and moon orbits',
  'Leuchteffekt (Bloom)': 'Glow (bloom)',
  'Helle Objekte strahlen': 'Bright objects glow',
  'Warp-Effekt': 'Warp effect',
  'Bewegungsunschärfe bei schnellen Flügen': 'Motion blur during fast flights',
  'Automatische Auflösung': 'Automatic resolution',
  'Senkt die Auflösung kurz, wenn es ruckelt – hält alles flüssig': 'Briefly lowers resolution when it stutters – keeps everything smooth',
  'Helligkeit': 'Brightness',
  'Belichtung der Szene': 'Scene exposure',
  'Grafikqualität': 'Graphics quality',
  'Anzahl der Partikel – wird nach Neuladen übernommen': 'Particle count – applied after reload',
  'Niedrig': 'Low', 'Mittel': 'Medium', 'Hoch': 'High', 'Ultra': 'Ultra',
  'Sprache': 'Language',
  'Sprache der Oberfläche und Beschreibungen': 'Language of interface and descriptions',
  'EINSTELLUNGEN': 'SETTINGS',
  'Qualität geändert. Jetzt neu laden?': 'Quality changed. Reload now?',
  'FAVORITEN': 'FAVORITES',
  'Entfernen': 'Remove',
  'Noch keine Favoriten. Wähle ein Objekt aus und klicke auf ★, um es hier zu speichern.': 'No favorites yet. Select an object and click ★ to save it here.',
  'Zeit: <b>Gegenwart</b>': 'Time: <b>present</b>',
  'Angehalten': 'Paused',
  'Beschriftungen <b>an</b>': 'Labels <b>on</b>',
  'Beschriftungen aus': 'Labels off',
  'Sternbilder <b>an</b>': 'Constellations <b>on</b>',
  'Sternbilder aus': 'Constellations off',
  'Stillstand': 'Stationary',
  'DU BIST HIER': 'YOU ARE HERE',
  'Sonnensystem': 'Solar System',
  'Orion-Arm': 'Orion Arm',
  '−10 Jahre / s': '−10 years / s', '−1 Jahr / s': '−1 year / s', '−1 Monat / s': '−1 month / s', '−1 Woche / s': '−1 week / s', '−1 Tag / s': '−1 day / s', '−1 Stunde / s': '−1 hour / s',
  '1 Minute / s': '1 minute / s', '1 Stunde / s': '1 hour / s', '1 Tag / s': '1 day / s', '1 Woche / s': '1 week / s', '1 Monat / s': '1 month / s', '1 Jahr / s': '1 year / s', '10 Jahre / s': '10 years / s',
  // main.js
  'Erde': 'Earth', 'Mondbahn': 'Lunar orbit', 'Innere Planeten': 'Inner planets', 'Oortsche Wolke': 'Oort Cloud',
  'Sternnachbarn': 'Stellar neighbors', 'Milchstraße': 'Milky Way', 'Lokale Gruppe': 'Local Group', 'Virgo-Superhaufen': 'Virgo Supercluster',
  'Laniakea': 'Laniakea', 'Kosmisches Netz': 'Cosmic web', 'Universum': 'Universe',
  'Initialisiere Raumzeit-Koordinatensystem …': 'Initializing space-time coordinate system …',
  'Sternkatalog HYG: {n} echte Sterne, {c} Sternbilder': 'HYG star catalog: {n} real stars, {c} constellations',
  'Sonnensystem: 8 Planeten, 12 Monde, Pluto, Raumsonden & Satelliten, Exoplaneten': 'Solar System: 8 planets, 12 moons, Pluto, probes & satellites, exoplanets',
  'Milchstraßen-Panorama & Sternbilder bereit': 'Milky Way panorama & constellations ready',
  'Generiere {m}': 'Generating {m}',
  'Navigationssysteme bereit.': 'Navigation systems ready.',
  'Willkommen an Bord! <b>Suche</b> ein Ziel, nutze die <b>Maßstabsleiter</b> links oder starte die <b>Tour</b>.': 'Welcome aboard! <b>Search</b> for a destination, use the <b>scale ladder</b> on the left or start the <b>tour</b>.',
  'Rendere <b>{q}</b>-Screenshot …': 'Rendering <b>{q}</b> screenshot …',
  'Screenshot fehlgeschlagen': 'Screenshot failed',
  '{q}-Screenshot <b>gespeichert</b> ({w} × {h})': '{q} screenshot <b>saved</b> ({w} × {h})',
  'Fehler: {m}': 'Error: {m}',
  // universe.js
  'Milchstraße: {n} Sternwolken generiert': 'Milky Way: {n} star clouds generated',
  'Akkretionsscheiben & Quasare': 'accretion disks & quasars',
  'Lokales Netz: {n} Galaxien': 'local web: {n} galaxies',
  'Supercluster-Netz: {n} Galaxiengruppen': 'supercluster web: {n} galaxy groups',
  'Tiefes Universum: {n} Strukturen': 'deep universe: {n} structures',
  'Kosmischer Mikrowellenhintergrund': 'cosmic microwave background',
  'Markierungen': 'markers',
  'BILDRATE': 'FRAME RATE',
  'Auto': 'Auto',
  'Erkannt: {g} · empfohlen „{q}“ · wird nach Neuladen übernommen': 'Detected: {g} · recommended "{q}" · applied after reload',
  'SCAN': 'SCAN',
  // Autopilot
  'Autopilot: Reise durch alle Galaxien (J)': 'Autopilot: journey through all galaxies (J)',
  'Autopilot <b>aktiv</b> – Reise durch alle Galaxien (J zum Beenden)': 'Autopilot <b>on</b> – journey through all galaxies (J to stop)',
  'Autopilot beendet': 'Autopilot stopped',
  'Autopilot <b>Sternenreise</b> – von Stern zu Stern, zu ihren Planeten (J zum Beenden)': 'Autopilot <b>star voyage</b> – from star to star and to their planets (J to stop)',
  'Autopilot → <b>{n}</b>': 'Autopilot → <b>{n}</b>',
  // Videoaufnahme
  'Video aufnehmen (R)': 'Record video (R)',
  'Aufnahme beenden (R)': 'Stop recording (R)',
  'VIDEO AUFNEHMEN': 'RECORD VIDEO',
  'Dein Browser unterstützt keine Videoaufnahme. Bitte Chrome, Edge oder ein aktuelles Safari verwenden.': 'Your browser does not support video recording. Please use Chrome, Edge or a recent Safari.',
  'Auflösung': 'Resolution',
  'Höher = schärfer, aber anspruchsvoller für den Rechner': 'Higher = sharper, but more demanding for your computer',
  'Bildschirm': 'Screen',
  'Bildrate': 'Frame rate',
  '30 FPS ist auf schwächeren Rechnern gleichmäßiger': '30 FPS is smoother on less powerful computers',
  'OPTIONEN': 'OPTIONS',
  'Geführte Tour aufnehmen': 'Record the guided tour',
  'Weltraum-Klang mit aufnehmen': 'Include space sound',
  'Oberfläche während der Aufnahme ausblenden': 'Hide interface while recording',
  'Aufgenommen wird die 3D-Ansicht ohne Bedienelemente und Beschriftungen. Beenden mit R oder dem ■-Knopf oben – das Video wird danach automatisch gespeichert.': 'The 3D view is recorded without controls and labels. Stop with R or the ■ button at the top – the video is then saved automatically.',
  'AUFNAHME STARTEN': 'START RECORDING',
  'Aufnahme <b>läuft</b> – R zum Beenden': 'Recording <b>started</b> – press R to stop',
  'Aufnahme nicht möglich: {m}': 'Recording not possible: {m}',
  'Aufnahme war leer': 'Recording was empty',
  'Video <b>gespeichert</b> ({mb} MB, {ext})': 'Video <b>saved</b> ({mb} MB, {ext})',
  'Während der Aufnahme kein Screenshot möglich': 'No screenshot possible while recording',
  // Oberfläche anpassen
  'Oberfläche anpassen': 'Customize interface',
  'Elemente, Größe, Farbe & Beschriftungen': 'Elements, size, color & labels',
  'Öffnen': 'Open',
  'OBERFLÄCHE ANPASSEN': 'CUSTOMIZE INTERFACE',
  'VORLAGEN': 'PRESETS',
  'Vollständig': 'Complete', 'Alles sichtbar': 'Everything visible',
  'Entdecker': 'Explorer', 'Ohne Zahlen': 'Without numbers',
  'Minimal': 'Minimal', 'Nur das Nötigste': 'Just the essentials',
  'Zurücksetzen': 'Reset', 'Standardwerte': 'Default values',
  'ANGEZEIGTE ELEMENTE': 'VISIBLE ELEMENTS',
  'Kopfleiste & Suche': 'Top bar & search', 'Maßstabsleiter': 'Scale ladder', 'Info-Panel': 'Info panel',
  'Telemetrie': 'Telemetry', 'Zeitsteuerung': 'Time controls', '„Du bist hier“': '"You are here"',
  'Maßstabsbalken': 'Scale bar', 'Kompass & Zoom': 'Compass & zoom', 'Heim-Knopf': 'Home button',
  'Zielmarkierung': 'Target marker', 'Richtungspfeile': 'Direction arrows', 'Hinweise': 'Notifications',
  'Scanlines & Vignette': 'Scanlines & vignette',
  'DARSTELLUNG': 'APPEARANCE',
  'Größe der Oberfläche': 'Interface size', 'Deckkraft der Panels': 'Panel opacity', 'Akzentfarbe': 'Accent color',
  'Schriftstil': 'Font style', 'Futuristisch': 'Futuristic', 'Schlicht': 'Clean',
  'BESCHRIFTUNGEN IM ALL': 'LABELS IN SPACE', 'Objektnamen': 'Object names',
  'Schriftgröße der Namen': 'Label size', 'Anzahl der Namen': 'Number of labels',
  'Wenige': 'Few', 'Normal': 'Normal', 'Viele': 'Many',
  'Tipp: Mit U blendest du die gesamte Oberfläche jederzeit kurz aus.': 'Tip: press U to hide the entire interface at any time.',
  // Tour
  'STATION {i} / {n}': 'STOP {i} / {n}',
};

export function t(de, vars) {
  let s = EN ? (DICT[de] ?? de) : de;
  if (vars) for (const k in vars) s = s.replaceAll('{' + k + '}', vars[k]);
  return s;
}

// Statische Texte im HTML übersetzen (data-i18n, data-i18n-title, data-i18n-ph)
export function translateDom(root = document) {
  document.documentElement.lang = LANG;
  if (!EN) return;
  root.querySelectorAll('[data-i18n]').forEach((el) => { el.textContent = t(el.textContent.trim()); });
  root.querySelectorAll('[title]').forEach((el) => { el.title = t(el.title); });
  root.querySelectorAll('[placeholder]').forEach((el) => { el.placeholder = t(el.placeholder); });
}
