import * as THREE from 'three';
import { radecToWorld, GC_POS, ECL_NORTH, EQ_NORTH, GAL_NORTH, galaxyNormal, radecToDir } from '../core/coords.js';
import { KM_LY, AU_LY, R_SUN_LY } from '../core/units.js';
import { EN } from '../i18n.js';
import { EN_CATALOG, EN_CAT_LABEL } from './catalog_en.js';

// ---------------------------------------------------------------------------
// Objektkatalog. Positionen in Lichtjahren relativ zur Sonne.
// Entfernungen jenseits ~100 Mio. Lj sind mitbewegte Entfernungen.
// ---------------------------------------------------------------------------

export const CATALOG = [];
export const BY_ID = new Map();

const KLY = 1e3, MLY = 1e6, GLY = 1e9;

export function addObject(o) { return add(o); }

function add(o) {
  o.pos = o.pos || new THREE.Vector3();
  o.importance = o.importance ?? 5;
  CATALOG.push(o);
  BY_ID.set(o.id, o);
  return o;
}

// --- Sonnensystem -----------------------------------------------------------
const PL = (o) => add({ cat: 'planet', parent: 'sun', labelMax: 900 * AU_LY, importance: 7, ...o, radius: o.rKm * KM_LY });

add({
  id: 'sun', name: 'Sonne', cat: 'star', type: 'Stern · G2V', radius: R_SUN_LY, labelMax: 2500, importance: 10,
  up: 'ecl', view: { r: R_SUN_LY * 4.5, pitch: 12 }, tempK: 5772, lum: 1,
  desc: 'Unser Stern: eine 4,6 Milliarden Jahre alte Kugel aus Wasserstoff und Helium. In ihrem Kern verschmelzen jede Sekunde rund 600 Millionen Tonnen Wasserstoff zu Helium – die Energiequelle allen Lebens auf der Erde.',
  facts: [['Durchmesser', '1,39 Mio. km'], ['Oberfläche', '5.772 K'], ['Kerntemperatur', '15 Mio. K'], ['Masse', '333.000 Erdmassen'], ['Alter', '4,6 Mrd. Jahre']],
});
PL({ id: 'mercury', name: 'Merkur', type: 'Gesteinsplanet', rKm: 2440, orbit: { a: 0.387, P: 87.969, L0: 252.25 }, tilt: 0.03, rotH: 1407.6, look: 'mercury',
  desc: 'Der kleinste und sonnennächste Planet. Tagsüber über 400 °C heiß, nachts −180 °C – eine Atmosphäre, die Wärme speichern könnte, fehlt fast völlig.',
  facts: [['Durchmesser', '4.879 km'], ['Umlaufzeit', '88 Tage'], ['Tageslänge', '176 Erdtage'], ['Monde', '0']] });
PL({ id: 'venus', name: 'Venus', type: 'Gesteinsplanet', rKm: 6052, orbit: { a: 0.723, P: 224.701, L0: 181.98 }, tilt: 177.4, rotH: -5832.5, look: 'venus',
  desc: 'Fast so groß wie die Erde, aber unter einer dichten CO₂-Atmosphäre mit 92-fachem Erddruck gefangen. Mit rund 465 °C ist sie der heißeste Planet des Sonnensystems.',
  facts: [['Durchmesser', '12.104 km'], ['Umlaufzeit', '225 Tage'], ['Tageslänge', '243 Erdtage (rückläufig)'], ['Monde', '0']] });
PL({ id: 'earth', name: 'Erde', type: 'Gesteinsplanet · Heimat', rKm: 6371, orbit: { a: 1.0, P: 365.256, L0: 100.46 }, tilt: 23.44, rotH: 23.934, look: 'earth', importance: 10,
  up: 'eq', view: { pitch: 18 },
  desc: 'Der einzige bekannte Ort im Universum, an dem Leben existiert. 71 % der Oberfläche sind von Ozeanen bedeckt, die Atmosphäre schützt vor kosmischer Strahlung.',
  facts: [['Durchmesser', '12.742 km'], ['Umlaufzeit', '365,25 Tage'], ['Entfernung zur Sonne', '149,6 Mio. km'], ['Monde', '1'], ['Alter', '4,54 Mrd. Jahre']] });
add({ id: 'moon', name: 'Mond', cat: 'moon', type: 'Mond der Erde', parent: 'earth', radius: 1737 * KM_LY, labelMax: 0.03 * AU_LY, importance: 6, look: 'moon', rotH: 655.7, tilt: 6.7,
  desc: 'Der einzige natürliche Satellit der Erde und der einzige fremde Himmelskörper, den Menschen betreten haben – zuerst mit Apollo 11 im Jahr 1969.',
  facts: [['Durchmesser', '3.474 km'], ['Entfernung', '384.400 km'], ['Umlaufzeit', '27,3 Tage']] });
PL({ id: 'mars', name: 'Mars', type: 'Gesteinsplanet', rKm: 3390, orbit: { a: 1.524, P: 686.98, L0: 355.45 }, tilt: 25.19, rotH: 24.62, look: 'mars',
  desc: 'Der Rote Planet verdankt seine Farbe Eisenoxid im Staub. Hier steht mit dem Olympus Mons der höchste Vulkan des Sonnensystems – rund 22 km hoch.',
  facts: [['Durchmesser', '6.779 km'], ['Umlaufzeit', '687 Tage'], ['Tageslänge', '24,6 Stunden'], ['Monde', '2 (Phobos, Deimos)']] });
PL({ id: 'jupiter', name: 'Jupiter', type: 'Gasriese', rKm: 69911, orbit: { a: 5.203, P: 4332.59, L0: 34.40 }, tilt: 3.13, rotH: 9.925, look: 'jupiter', importance: 8,
  desc: 'Der Riese unter den Planeten – mehr als doppelt so massereich wie alle anderen Planeten zusammen. Sein Großer Roter Fleck ist ein Sturm, größer als die ganze Erde.',
  facts: [['Durchmesser', '139.820 km'], ['Umlaufzeit', '11,9 Jahre'], ['Tageslänge', '9,9 Stunden'], ['Monde', 'über 90']] });
PL({ id: 'saturn', name: 'Saturn', type: 'Gasriese', rKm: 58232, orbit: { a: 9.537, P: 10759.22, L0: 49.94 }, tilt: 26.73, rotH: 10.66, look: 'saturn', importance: 8,
  view: { r: 58232 * KM_LY * 6, pitch: 20 },
  desc: 'Berühmt für sein spektakuläres Ringsystem aus Eis und Gestein, das 280.000 km überspannt, aber oft nur 10 m dick ist. Saturn ist so leicht, dass er in Wasser schwimmen würde.',
  facts: [['Durchmesser', '116.460 km'], ['Umlaufzeit', '29,5 Jahre'], ['Dichte', '0,69 g/cm³'], ['Monde', 'über 250']] });
PL({ id: 'uranus', name: 'Uranus', type: 'Eisriese', rKm: 25362, orbit: { a: 19.19, P: 30688.5, L0: 313.23 }, tilt: 97.77, rotH: -17.24, look: 'uranus',
  desc: 'Ein Eisriese, der auf der Seite liegt: Seine Achse ist um 98° geneigt – vermutlich die Folge einer gewaltigen Kollision in der Frühzeit des Sonnensystems.',
  facts: [['Durchmesser', '50.724 km'], ['Umlaufzeit', '84 Jahre'], ['Temperatur', '−224 °C'], ['Monde', '28']] });
PL({ id: 'neptune', name: 'Neptun', type: 'Eisriese', rKm: 24622, orbit: { a: 30.07, P: 60182, L0: 304.88 }, tilt: 28.32, rotH: 16.11, look: 'neptune',
  desc: 'Der äußerste Planet. Auf Neptun toben die schnellsten Winde des Sonnensystems mit über 2.000 km/h. Er wurde 1846 durch Berechnung vorhergesagt, bevor man ihn sah.',
  facts: [['Durchmesser', '49.244 km'], ['Umlaufzeit', '165 Jahre'], ['Windgeschwindigkeit', 'bis 2.100 km/h'], ['Monde', '16']] });
PL({ id: 'pluto', name: 'Pluto', type: 'Zwergplanet', rKm: 1188, orbit: { a: 39.48, P: 90560, L0: 238.93 }, tilt: 122.5, rotH: -153.3, look: 'pluto', importance: 5,
  desc: 'Seit 2006 als Zwergplanet eingestuft. Die Sonde New Horizons enthüllte 2015 eine herzförmige Ebene aus gefrorenem Stickstoff: die Sputnik Planitia.',
  facts: [['Durchmesser', '2.377 km'], ['Umlaufzeit', '248 Jahre'], ['Temperatur', '−230 °C'], ['Monde', '5']] });
add({ id: 'voyager1', name: 'Voyager 1', cat: 'probe', type: 'Raumsonde', parent: 'sun', radius: 2e-12, labelMax: 2500 * AU_LY, importance: 5,
  view: { r: 0.6 * AU_LY, pitch: 10 },
  desc: 'Das am weitesten entfernte von Menschen gebaute Objekt. Seit 1977 unterwegs, verließ Voyager 1 im Jahr 2012 die Heliosphäre und fliegt seitdem durch den interstellaren Raum.',
  facts: [['Start', '5. September 1977'], ['Geschwindigkeit', '≈ 17 km/s'], ['Funksignal-Laufzeit', '≈ 23 Stunden']] });


// --- Monde der Planeten (Bahnradius km, Umlauf Tage; negativ = rückläufig) ---
function M(id, name, parent, rKm, aKm, P, look, desc, facts, extra = {}) {
  return add({ id, name, cat: 'moon', type: extra.type || 'Mond', parent, radius: rKm * KM_LY, moonOrbit: { aKm, P, L0: extra.L0 ?? (id.length * 47) % 360 },
    look, labelMax: aKm * KM_LY * 40, importance: extra.importance ?? 4, desc, facts, ...extra });
}
M('phobos', 'Phobos', 'mars', 11.3, 9376, 0.319, 'phobos', 'Der größere der beiden Marsmonde – ein dunkler, kartoffelförmiger Brocken, der dem Mars jedes Jahrhundert ein Stück näher kommt und eines Tages zerbrechen wird.', [['Durchmesser', '≈ 22 km'], ['Umlauf', '7,7 Stunden']]);
M('deimos', 'Deimos', 'mars', 6.2, 23460, 1.263, 'phobos', 'Der kleinere Marsmond, wahrscheinlich ein eingefangener Asteroid.', [['Durchmesser', '≈ 12 km'], ['Umlauf', '30 Stunden']]);
M('io', 'Io', 'jupiter', 1821.6, 421700, 1.769, 'io', 'Der vulkanisch aktivste Körper des Sonnensystems: Über 400 Vulkane speien Schwefel – Jupiters Gezeitenkräfte kneten Io unablässig durch.', [['Durchmesser', '3.643 km'], ['Umlauf', '1,8 Tage']], { importance: 6 });
M('europa', 'Europa', 'jupiter', 1560.8, 671034, 3.551, 'europa', 'Unter ihrem Eispanzer liegt ein globaler Ozean mit mehr Wasser als alle Meere der Erde zusammen – einer der aussichtsreichsten Orte für außerirdisches Leben.', [['Durchmesser', '3.122 km'], ['Ozeantiefe', '≈ 100 km']], { importance: 7 });
M('ganymede', 'Ganymed', 'jupiter', 2634.1, 1070412, 7.155, 'ganymede', 'Der größte Mond des Sonnensystems – größer als der Planet Merkur – und der einzige Mond mit eigenem Magnetfeld.', [['Durchmesser', '5.268 km'], ['Umlauf', '7,2 Tage']], { importance: 6 });
M('callisto', 'Kallisto', 'jupiter', 2410.3, 1882709, 16.689, 'callisto', 'Die am stärksten verkraterte Oberfläche im Sonnensystem – seit Milliarden Jahren nahezu unverändert.', [['Durchmesser', '4.821 km'], ['Umlauf', '16,7 Tage']]);
M('titan', 'Titan', 'saturn', 2574.7, 1221870, 15.945, 'titan', 'Der einzige Mond mit dichter Atmosphäre. Unter dem orangefarbenen Dunst liegen Seen aus flüssigem Methan. 2034 soll die Drohne Dragonfly hier landen.', [['Durchmesser', '5.150 km'], ['Luftdruck', '1,5 × Erde']], { importance: 7 });
M('enceladus', 'Enceladus', 'saturn', 252.1, 237948, 1.370, 'enceladus', 'Ein strahlend weißer Eismond, aus dessen Südpol Wasserfontänen ins All schießen – gespeist von einem unterirdischen Ozean.', [['Durchmesser', '504 km'], ['Albedo', '≈ 0,99']], { importance: 5 });
M('mimas', 'Mimas', 'saturn', 198.2, 185539, 0.942, 'callisto', 'Der Krater Herschel gibt ihm das Aussehen des „Todessterns“ aus Star Wars.', [['Durchmesser', '396 km'], ['Krater Herschel', '130 km']]);
M('triton', 'Triton', 'neptune', 1353.4, 354759, -5.877, 'triton', 'Umkreist Neptun rückwärts – ein eingefangenes Objekt aus dem Kuipergürtel, mit Stickstoff-Geysiren auf seiner eisigen Oberfläche.', [['Durchmesser', '2.707 km'], ['Temperatur', '−235 °C']], { importance: 5 });
M('charon', 'Charon', 'pluto', 606, 19591, 6.387, 'charon', 'Fast halb so groß wie Pluto – beide umkreisen einen gemeinsamen Schwerpunkt im leeren Raum zwischen ihnen.', [['Durchmesser', '1.212 km']]);

// --- Exoplaneten (künstlerische Darstellung, Bahnen in AE) -----------------
function X(id, name, star, rEarth, aAU, P, look, desc, facts, extra = {}) {
  return add({ id, name, cat: 'planet', type: extra.type || 'Exoplanet', parent: star, radius: rEarth * 6371 * KM_LY,
    exoOrbit: { a: aAU, P, L0: (id.length * 73) % 360 }, look, labelMax: aAU * AU_LY * 60, importance: extra.importance ?? 5, exo: true,
    desc: desc + ' (Oberfläche: künstlerische Darstellung)', facts, ...extra });
}
X('proximab', 'Proxima b', 'proxima', 1.07, 0.0485, 11.19, 'barren', 'Der nächste bekannte Exoplanet: etwas größer als die Erde, in der habitablen Zone seines Roten Zwergs – aber heftigen Strahlungsausbrüchen ausgesetzt.', [['Masse', '≥ 1,07 Erden'], ['Umlauf', '11,2 Tage'], ['Entdeckt', '2016']], { importance: 7 });
const TR = [['b', 1.116, 0.01154, 1.511, 'lava'], ['c', 1.097, 0.0158, 2.422, 'lava'], ['d', 0.788, 0.02227, 4.05, 'desert'], ['e', 0.92, 0.02925, 6.1, 'terra'], ['f', 1.045, 0.03849, 9.207, 'ocean'], ['g', 1.129, 0.04683, 12.35, 'ice'], ['h', 0.755, 0.06189, 18.77, 'ice']];
for (const [l, r, a, P, look] of TR) {
  X('trappist1' + l, 'TRAPPIST-1 ' + l, 'trappist1', r, a, P, look,
    l === 'e' ? 'Der vielversprechendste der sieben Planeten: erdgroß, felsig und in der habitablen Zone – flüssiges Wasser wäre hier möglich.'
      : l === 'b' || l === 'c' ? 'Ein heißer, felsiger Planet sehr nah an seinem Stern. Das James-Webb-Teleskop fand hier kaum Hinweise auf eine Atmosphäre.'
        : 'Einer von sieben erdgroßen Planeten, die den Zwergstern TRAPPIST-1 dicht gedrängt umkreisen.',
    [['Radius', String(r).replace('.', ',') + ' Erden'], ['Umlauf', String(P).replace('.', ',') + ' Tage']], { importance: l === 'e' ? 6 : 4 });
}

// --- Raumfahrzeuge -------------------------------------------------------
function SC(id, name, type, desc, facts, extra) {
  return add({ id, name, cat: 'probe', type, radius: 2e-12, importance: 5, view: { r: extra.viewR ?? 0.6 * AU_LY, pitch: 10 }, desc, facts, ...extra });
}
SC('iss', 'ISS', 'Internationale Raumstation', 'Das größte von Menschen gebaute Objekt im All: seit 2000 ständig bewohnt, umrundet sie die Erde alle 93 Minuten in rund 420 km Höhe.', [['Höhe', '≈ 420 km'], ['Geschwindigkeit', '27.600 km/h'], ['Umlauf', '93 Minuten']], { sat: { altKm: 420, Pmin: 92.9, incl: 51.6 }, labelMax: 0.02 * AU_LY, viewR: 3000 * KM_LY, importance: 6 });
SC('hubble', 'Hubble', 'Weltraumteleskop', 'Seit 1990 im Erdorbit – Hubble hat unser Bild des Universums geprägt wie kaum ein anderes Instrument.', [['Höhe', '≈ 530 km'], ['Start', '24. April 1990']], { sat: { altKm: 530, Pmin: 95.2, incl: 28.5 }, labelMax: 0.02 * AU_LY, viewR: 3000 * KM_LY });
SC('jwst', 'James Webb', 'Weltraumteleskop', 'Das größte Weltraumteleskop: Es beobachtet im Infraroten vom Lagrange-Punkt L2 aus, 1,5 Mio. km jenseits der Erde – stets im Schatten seines Sonnenschilds.', [['Spiegel', '6,5 m'], ['Start', '25. Dezember 2021']], { l2: true, labelMax: 0.2 * AU_LY, viewR: 400000 * KM_LY, importance: 6 });
SC('voyager2', 'Voyager 2', 'Raumsonde', 'Die einzige Sonde, die alle vier Riesenplaneten besucht hat. Seit 2018 im interstellaren Raum.', [['Start', '20. August 1977'], ['Geschwindigkeit', '≈ 15 km/s']], { deep: { ra: 20.1, dec: -60, au2024: 136, auPerYear: 3.2 }, labelMax: 2500 * AU_LY });
SC('newhorizons', 'New Horizons', 'Raumsonde', 'Flog 2015 an Pluto vorbei und 2019 an Arrokoth – dem fernsten je besuchten Objekt.', [['Start', '19. Januar 2006'], ['Pluto-Vorbeiflug', '14. Juli 2015']], { deep: { ra: 19.3, dec: -20.5, au2024: 59, auPerYear: 2.9 }, labelMax: 2500 * AU_LY });
SC('pioneer10', 'Pioneer 10', 'Raumsonde', 'Die erste Sonde, die den Asteroidengürtel durchquerte und Jupiter besuchte. An Bord: eine Plakette mit einer Botschaft an Außerirdische.', [['Start', '3. März 1972'], ['Letzter Kontakt', '2003']], { deep: { ra: 5.2, dec: 26, au2024: 136, auPerYear: 2.5 }, labelMax: 2500 * AU_LY });

add({ id: 'asteroids', name: 'Asteroidengürtel', cat: 'region', type: 'Kleinkörperzone', parent: 'sun', radius: 3.3 * AU_LY, labelMax: 40 * AU_LY, importance: 3,
  anchorEcl: [2.7, 0.4], view: { r: 9 * AU_LY, pitch: 45 }, up: 'ecl', focusSun: true,
  desc: 'Zwischen Mars und Jupiter kreisen Millionen Gesteinsbrocken. Zusammen haben sie nur etwa 3 % der Masse des Mondes – der größte ist der Zwergplanet Ceres.',
  facts: [['Lage', '2,2 – 3,3 AE'], ['Größter Körper', 'Ceres (940 km)']] });
add({ id: 'kuiper', name: 'Kuipergürtel', cat: 'region', type: 'Eiskörperzone', parent: 'sun', radius: 50 * AU_LY, labelMax: 600 * AU_LY, importance: 3,
  anchorEcl: [44, 2.2], view: { r: 140 * AU_LY, pitch: 35 }, up: 'ecl', focusSun: true,
  desc: 'Ein Ring aus eisigen Körpern jenseits des Neptun – die Heimat von Pluto, Eris und unzähligen Kometen.',
  facts: [['Lage', '30 – 50 AE'], ['Bekannte Objekte', 'über 3.000']] });
add({ id: 'oort', name: 'Oortsche Wolke', cat: 'region', type: 'Kometenreservoir', parent: 'sun', radius: 1.58, labelMax: 30, importance: 4,
  anchorEcl: [60000, 5.5], view: { r: 4.2, pitch: 25 }, up: 'ecl', focusSun: true, regionR: 1.6,
  desc: 'Eine riesige, kugelförmige Hülle aus Billionen Eiskörpern, die das Sonnensystem bis fast zur Hälfte des Weges zum nächsten Stern umgibt. Von hier stammen langperiodische Kometen.',
  facts: [['Ausdehnung', '2.000 – 100.000 AE'], ['Objekte', 'geschätzt Billionen']] });

// --- Sterne (RA h, Dec °, Entfernung Lj, Radius R☉, L☉, T K) -------------------
function S(id, name, type, ra, dec, d, rSun, lum, tempK, desc, facts, extra = {}) {
  return add({ id, name, cat: 'star', type, radius: rSun * R_SUN_LY, ra, dec, dist: d, lum, tempK,
    labelMax: extra.labelMax ?? Math.min(6000, 25 * Math.pow(lum, 0.42) + 40), importance: extra.importance ?? 6,
    pos: radecToWorld(ra, dec, d), desc, facts, ...extra });
}
S('proxima', 'Proxima Centauri', 'Roter Zwerg · M5.5V', 14.4953, -62.679, 4.246, 0.154, 0.0017, 3042,
  'Der sonnennächste Stern – ein kleiner, kühler Roter Zwerg. Er wird vom Planeten Proxima b umkreist, der in der habitablen Zone liegt.',
  [['Durchmesser', '0,15 Sonnen'], ['Planeten', 'mind. 2']], { labelMax: 40, importance: 7 });
S('alphacen', 'Alpha Centauri', 'Doppelstern · G2V + K1V', 14.6600, -60.835, 4.37, 1.22, 1.52, 5790,
  'Ein sonnenähnliches Doppelsternsystem – mit bloßem Auge der dritthellste Stern am Himmel und das nächste Ziel für interstellare Sonden.',
  [['Durchmesser A', '1,22 Sonnen'], ['Abstand A–B', '11 – 36 AE']], { labelMax: 60, importance: 8 });
S('barnard', 'Barnards Pfeilstern', 'Roter Zwerg · M4V', 17.9634, 4.693, 5.96, 0.196, 0.0035, 3134,
  'Ein uralter Roter Zwerg mit der größten Eigenbewegung aller Sterne am Himmel.', [['Alter', '≈ 10 Mrd. Jahre']], { labelMax: 30 });
S('sirius', 'Sirius', 'Hauptreihenstern · A1V', 6.7525, -16.716, 8.6, 1.71, 25.4, 9940,
  'Der hellste Stern am Nachthimmel. Er wird von Sirius B begleitet, einem Weißen Zwerg von Erdgröße.', [['Durchmesser', '1,7 Sonnen'], ['Leuchtkraft', '25 Sonnen']], { importance: 8 });
S('epseri', 'Epsilon Eridani', 'Hauptreihenstern · K2V', 3.5490, -9.458, 10.5, 0.74, 0.34, 5084,
  'Ein junger, sonnenähnlicher Stern mit Staubscheibe und mindestens einem Gasriesen-Planeten.', [['Alter', '≈ 600 Mio. Jahre']], { labelMax: 40 });
S('procyon', 'Prokyon', 'Unterriese · F5IV', 7.655, 5.225, 11.46, 2.05, 6.9, 6530,
  'Der „Kleine Hund“: ein gelblich-weißer Stern mit einem Weißen Zwerg als Begleiter.', [['Leuchtkraft', '6,9 Sonnen']]);
S('altair', 'Altair', 'Hauptreihenstern · A7V', 19.8464, 8.868, 16.7, 1.8, 10.6, 7700,
  'Rotiert so schnell – einmal in rund 9 Stunden –, dass er am Äquator deutlich abgeplattet ist.', [['Rotation', '≈ 9 Stunden']]);
S('vega', 'Wega', 'Hauptreihenstern · A0V', 18.6156, 38.784, 25, 2.36, 40, 9600,
  'Ein Referenzstern der Astronomie und in rund 12.000 Jahren der Polarstern. Umgeben von einer kühlen Staubscheibe.', [['Leuchtkraft', '40 Sonnen']], { importance: 7 });
S('fomalhaut', 'Fomalhaut', 'Hauptreihenstern · A3V', 22.9608, -29.622, 25, 1.84, 16.6, 8590,
  'Umgeben von einem markanten, ringförmigen Trümmergürtel, den das Weltraumteleskop Hubble fotografierte.', [['Leuchtkraft', '16,6 Sonnen']]);
S('arcturus', 'Arktur', 'Roter Riese · K1.5III', 14.261, 19.182, 36.7, 25.4, 170, 4286,
  'Ein orangefarbener Riesenstern und der hellste Stern der nördlichen Himmelshalbkugel.', [['Durchmesser', '25 Sonnen']], { importance: 7 });
S('capella', 'Kapella', 'Riesen-System · G3III', 5.2782, 45.998, 42.9, 11.98, 79, 4970,
  'Eigentlich ein System aus vier Sternen, angeführt von zwei gelben Riesen.', [['Komponenten', '4 Sterne']]);
S('aldebaran', 'Aldebaran', 'Roter Riese · K5III', 4.5987, 16.509, 65, 44, 439, 3910,
  'Das „Auge des Stiers“: ein orangefarbener Riese, 44-mal größer als die Sonne.', [['Durchmesser', '44 Sonnen']]);
S('regulus', 'Regulus', 'Hauptreihenstern · B8IVn', 10.1395, 11.967, 79, 3.1, 288, 11670,
  'Der hellste Stern im Löwen – ein extrem schnell rotierender, blau-weißer Stern.', [['Leuchtkraft', '288 Sonnen']]);
S('polaris', 'Polarstern', 'Überriese · F7Ib', 2.5302, 89.264, 433, 37.5, 1260, 6015,
  'Er steht fast genau über dem Nordpol der Erde – die Erdachse zeigt auf ihn. Seit Jahrhunderten Orientierungspunkt der Seefahrt.', [['Durchmesser', '37 Sonnen'], ['Leuchtkraft', '1.260 Sonnen']], { importance: 8 });
S('betelgeuse', 'Beteigeuze', 'Roter Überriese · M1Ia', 5.9195, 7.407, 548, 764, 126000, 3500,
  'Ein Roter Überriese an der Schulter des Orion. An der Stelle der Sonne würde er weit über die Marsbahn hinausreichen. Eines Tages wird er als Supernova explodieren.',
  [['Durchmesser', '≈ 764 Sonnen'], ['Leuchtkraft', '126.000 Sonnen']], { importance: 9 });
S('rigel', 'Rigel', 'Blauer Überriese · B8Ia', 5.2423, -8.2016, 860, 78.9, 120000, 12100,
  'Ein blauer Überriese, rund 120.000-mal leuchtkräftiger als die Sonne – der Fuß des Orion.', [['Durchmesser', '79 Sonnen']], { importance: 8 });
S('antares', 'Antares', 'Roter Überriese · M1.5Iab', 16.4901, -26.432, 550, 680, 75900, 3400,
  'Das „Herz des Skorpions“. Sein Name bedeutet „Rivale des Mars“ – wegen seiner rötlichen Farbe.', [['Durchmesser', '≈ 680 Sonnen']], { importance: 7 });
S('canopus', 'Canopus', 'Heller Riese · A9II', 6.3992, -52.696, 310, 71, 10700, 7400,
  'Der zweithellste Stern am Nachthimmel – Raumsonden nutzen ihn zur Lagebestimmung.', [['Leuchtkraft', '10.700 Sonnen']]);
S('deneb', 'Deneb', 'Weißer Überriese · A2Ia', 20.6905, 45.280, 2600, 203, 196000, 8525,
  'Einer der leuchtkräftigsten Sterne, die wir mit bloßem Auge sehen – rund 200.000-mal heller als die Sonne.', [['Leuchtkraft', '≈ 196.000 Sonnen']]);
S('spica', 'Spica', 'Doppelstern · B1III', 13.4199, -11.161, 250, 7.47, 20500, 25300,
  'Ein enges Paar heißer blauer Sterne, die sich in nur vier Tagen umkreisen.', [['Umlaufzeit', '4 Tage']]);
S('trappist1', 'TRAPPIST-1', 'Ultrakühler Zwerg · M8V', 23.1063, -5.041, 40.7, 0.119, 0.00055, 2566,
  'Ein winziger Stern mit sieben erdgroßen Planeten – drei davon in der habitablen Zone. Ein Top-Ziel bei der Suche nach Leben.', [['Planeten', '7']], { labelMax: 90, importance: 7 });
S('etacar', 'Eta Carinae', 'Leuchtkräftiger Blauer Veränderlicher', 10.7514, -59.684, 7500, 240, 5e6, 25000,
  'Ein instabiles Doppelsternsystem von über 100 Sonnenmassen. 1843 leuchtete es kurzzeitig als zweithellster Stern am Himmel auf.', [['Masse', '> 100 Sonnen'], ['Leuchtkraft', '≈ 5 Mio. Sonnen']], { importance: 7 });
S('uyscuti', 'UY Scuti', 'Roter Überriese · M4Ia', 18.4590, -12.461, 5900, 909, 340000, 3365,
  'Einer der größten bekannten Sterne: Ein Lichtstrahl bräuchte rund 7 Stunden, um ihn einmal zu umrunden.', [['Durchmesser', '≈ 909 Sonnen']], { importance: 6 });
S('vycma', 'VY Canis Majoris', 'Roter Hyperriese · M3Ia', 7.3804, -25.767, 3900, 1420, 270000, 3490,
  'Ein gigantischer Hyperriese, der enorme Mengen Materie ins All abstößt und in Staubwolken gehüllt ist.', [['Durchmesser', '≈ 1.420 Sonnen']], { importance: 6 });

// --- Nebel & Sternhaufen -----------------------------------------------------
function N(id, name, type, ra, dec, d, r, nebula, desc, facts, extra = {}) {
  return add({ id, name, cat: 'nebula', type, radius: r, ra, dec, dist: d, nebula, pos: radecToWorld(ra, dec, d),
    labelMax: extra.labelMax ?? 9000, importance: 6, view: { r: r * 3.2, pitch: 15 }, desc, facts, ...extra });
}
N('orion', 'Orionnebel', 'Emissionsnebel · M42', 5.5881, -5.391, 1344, 12, 'emission',
  'Die nächstgelegene große Sternentstehungsregion. Mit bloßem Auge als verschwommener Fleck im Schwert des Orion sichtbar.', [['Durchmesser', '≈ 24 Lj'], ['Alter', '≈ 2 Mio. Jahre']], { importance: 8 });
N('eagle', 'Adlernebel', 'Emissionsnebel · M16', 18.3131, -13.81, 5700, 35, 'pillars',
  'Heimat der berühmten „Säulen der Schöpfung“ – mehrere Lichtjahre hohe Gas- und Staubtürme, in denen neue Sterne entstehen.', [['Ausdehnung', '≈ 70 × 55 Lj'], ['Säulen', 'bis 4 Lj hoch']], { importance: 7 });
N('crab', 'Krebsnebel', 'Supernova-Überrest · M1', 5.5755, 22.0145, 6500, 5.5, 'snr',
  'Überrest einer Supernova, die im Jahr 1054 von chinesischen Astronomen beobachtet wurde. In seinem Zentrum rotiert ein Pulsar 30-mal pro Sekunde.', [['Durchmesser', '≈ 11 Lj'], ['Explosion', '1054 n. Chr.']]);
N('carina', 'Carinanebel', 'Emissionsnebel · NGC 3372', 10.7522, -59.867, 8500, 110, 'emission',
  'Einer der größten und hellsten Nebel der Milchstraße – Heimat von Eta Carinae und zahlreichen jungen, massereichen Sternen.', [['Ausdehnung', '> 200 Lj']]);
N('ring', 'Ringnebel', 'Planetarischer Nebel · M57', 18.8930, 33.029, 2570, 0.65, 'planetary',
  'Die abgestoßene Hülle eines sterbenden sonnenähnlichen Sterns. So ähnlich könnte auch unsere Sonne in rund 5 Milliarden Jahren enden.', [['Durchmesser', '≈ 1,3 Lj']], { labelMax: 3000 });
N('helix', 'Helixnebel', 'Planetarischer Nebel · NGC 7293', 22.4954, -20.837, 655, 1.4, 'planetary',
  'Wegen seines Aussehens auch „Auge Gottes“ genannt – einer der nächstgelegenen Planetarischen Nebel.', [['Durchmesser', '≈ 2,9 Lj']], { labelMax: 2500 });
N('pleiades', 'Plejaden', 'Offener Sternhaufen · M45', 3.7914, 24.117, 444, 8, 'openCluster',
  'Das „Siebengestirn“: ein junger Sternhaufen aus über 1.000 Sternen, umhüllt von bläulichem Reflexionsnebel.', [['Alter', '≈ 100 Mio. Jahre'], ['Sterne', '> 1.000']], { importance: 7 });
N('omegacen', 'Omega Centauri', 'Kugelsternhaufen · NGC 5139', 13.4461, -47.479, 17700, 86, 'globular',
  'Der größte Kugelsternhaufen der Milchstraße mit rund 10 Millionen Sternen – vermutlich der Kern einer einverleibten Zwerggalaxie.', [['Sterne', '≈ 10 Mio.'], ['Alter', '≈ 12 Mrd. Jahre']], { labelMax: 40000 });
N('m13', 'Herkuleshaufen', 'Kugelsternhaufen · M13', 16.6949, 36.461, 22200, 72, 'globular',
  'Ein Kugelsternhaufen aus mehreren hunderttausend Sternen. 1974 wurde die Arecibo-Botschaft in seine Richtung gesendet.', [['Sterne', '≈ 300.000']], { labelMax: 40000 });
N('tarantula', 'Tarantelnebel', 'Emissionsnebel · 30 Doradus', 5.6458, -69.10, 160000, 300, 'emission',
  'Die aktivste Sternentstehungsregion der gesamten Lokalen Gruppe – in der Großen Magellanschen Wolke.', [['Durchmesser', '≈ 600 Lj']], { labelMax: 60000 });

// --- Milchstraße -------------------------------------------------------------
add({ id: 'milkyway', name: 'Milchstraße', cat: 'galaxy', type: 'Balkenspiralgalaxie · SBbc', radius: 52000, pos: GC_POS.clone(),
  labelMax: 4e7, importance: 10, up: 'gal', view: { r: 135000, pitch: 52 }, regionR: 70000,
  desc: 'Unsere Heimatgalaxie: eine Balkenspiralgalaxie mit 100 bis 400 Milliarden Sternen. Die Sonne liegt im Orion-Arm, rund 26.700 Lichtjahre vom Zentrum entfernt, und umrundet es einmal in 230 Millionen Jahren.',
  facts: [['Durchmesser', '≈ 100.000 Lj'], ['Sterne', '100 – 400 Mrd.'], ['Alter', '≈ 13,6 Mrd. Jahre'], ['Galaktisches Jahr', '230 Mio. Jahre']] });
add({ id: 'sgra', name: 'Sagittarius A*', cat: 'blackhole', type: 'Supermassereiches Schwarzes Loch', pos: GC_POS.clone(),
  radius: 1.27e7 * KM_LY, labelMax: 90000, importance: 8, bh: { rs: 1.27e7 * KM_LY, jet: false, up: 'gal' }, up: 'gal',
  view: { r: 1.27e7 * KM_LY * 20, pitch: 12 },
  desc: 'Das Schwarze Loch im Zentrum der Milchstraße mit 4,3 Millionen Sonnenmassen. 2022 veröffentlichte das Event Horizon Telescope sein erstes Bild.',
  facts: [['Masse', '4,3 Mio. Sonnen'], ['Ereignishorizont', '≈ 25 Mio. km Ø']] });

// --- Galaxien ----------------------------------------------------------------
function G(id, name, type, ra, dec, d, diam, gal, desc, facts, extra = {}) {
  const pos = radecToWorld(ra, dec, d);
  const normal = galaxyNormal(pos, gal.incl ?? 45, gal.pa ?? 30);
  return add({ id, name, cat: 'galaxy', type, ra, dec, dist: d, radius: diam / 2, pos, gal: { ...gal, normal },
    up: 'normal', labelMax: extra.labelMax ?? Math.max(6e6, diam * 220), importance: 6,
    view: { r: diam * 1.25, pitch: gal.viewPitch ?? 38 }, desc, facts, regionR: diam * 0.7, ...extra });
}
G('andromeda', 'Andromeda-Galaxie', 'Spiralgalaxie · M31', 0.7123, 41.269, 2.537 * MLY, 152000,
  { kind: 'spiral', arms: 2, incl: 77, pa: 38, count: 1.0, bulge: 0.22, pitch: 11, colorTint: [1, 0.95, 0.9], viewPitch: 28 },
  'Die nächste große Spiralgalaxie und das fernste Objekt, das man mit bloßem Auge sehen kann. In rund 4,5 Milliarden Jahren wird sie mit der Milchstraße zu einer elliptischen Riesengalaxie verschmelzen.',
  [['Durchmesser', '≈ 150.000 Lj'], ['Sterne', '≈ 1 Billion'], ['Annäherung', '110 km/s']], { importance: 10, labelMax: 6e8 });
G('m33', 'Dreiecksgalaxie', 'Spiralgalaxie · M33', 1.5642, 30.66, 2.73 * MLY, 60000,
  { kind: 'spiral', arms: 2, incl: 54, pa: 23, count: 0.35, bulge: 0.05, pitch: 22, flocculent: true },
  'Die drittgrößte Galaxie der Lokalen Gruppe – eine lockere Spirale mit riesigen Sternentstehungsgebieten.', [['Durchmesser', '≈ 60.000 Lj'], ['Sterne', '≈ 40 Mrd.']], { importance: 8, labelMax: 1.5e8 });
G('m32', 'M32', 'Zwerg-Ellipse · cE2', 0.7117, 40.865, 2.49 * MLY, 6500,
  { kind: 'elliptical', incl: 50, pa: 10, count: 0.06, q: 0.8 },
  'Eine kompakte elliptische Zwerggalaxie, die eng um Andromeda kreist – womöglich der Kern einer zerrupften größeren Galaxie.', [['Durchmesser', '≈ 6.500 Lj']], { importance: 4, labelMax: 1.2e6 });
G('m110', 'M110', 'Zwerg-Ellipse · E5', 0.6728, 41.685, 2.69 * MLY, 17000,
  { kind: 'elliptical', incl: 60, pa: 80, count: 0.07, q: 0.5 },
  'Eine elliptische Zwerggalaxie und Begleiterin der Andromeda-Galaxie, mit Spuren junger Sterne in ihrem Zentrum.', [['Durchmesser', '≈ 17.000 Lj']], { importance: 4, labelMax: 1.2e6 });
G('lmc', 'Große Magellansche Wolke', 'Irreguläre Galaxie · SBm', 5.393, -69.756, 163000, 32000,
  { kind: 'irregular', bar: true, incl: 35, pa: 170, count: 0.3, viewPitch: 45 },
  'Die größte Begleitgalaxie der Milchstraße, am Südhimmel mit bloßem Auge sichtbar. 1987 explodierte hier die hellste Supernova seit Jahrhunderten.', [['Durchmesser', '≈ 32.000 Lj'], ['Sterne', '≈ 30 Mrd.']], { importance: 9, labelMax: 4e7 });
G('smc', 'Kleine Magellansche Wolke', 'Irreguläre Zwerggalaxie', 0.879, -72.83, 203000, 19000,
  { kind: 'irregular', incl: 60, pa: 45, count: 0.15 },
  'Eine Zwerggalaxie, die mit ihrer großen Schwester durch eine Brücke aus Gas und Sternen verbunden ist.', [['Durchmesser', '≈ 19.000 Lj']], { importance: 7, labelMax: 3e7 });
G('sgrdsph', 'Sagittarius-Zwerggalaxie', 'Zwerg-Sphäroidal', 18.918, -30.545, 70000, 10000,
  { kind: 'dwarf', incl: 70, pa: 100, count: 0.05, q: 0.35, dim: 0.35 },
  'Wird gerade von der Milchstraße zerrissen – ihre Sternströme umschlingen unsere Galaxie wie ein Band.', [['Durchmesser', '≈ 10.000 Lj']], { importance: 4, labelMax: 1.5e6 });
G('cmadwarf', 'Canis-Major-Zwerggalaxie', 'Zwerggalaxie (umstritten)', 7.21, -27.67, 25000, 6000,
  { kind: 'dwarf', incl: 70, pa: 20, count: 0.03, q: 0.5, dim: 0.25 },
  'Ein umstrittenes Objekt: vielleicht der nächste Galaxienrest – vielleicht nur eine Verwerfung der Milchstraßenscheibe.', [['Durchmesser', '≈ 6.000 Lj']], { importance: 3, labelMax: 4e5 });
G('ngc6822', 'Barnards Galaxie', 'Irreguläre Zwerggalaxie · NGC 6822', 19.749, -14.80, 1.63 * MLY, 7000,
  { kind: 'irregular', incl: 50, pa: 10, count: 0.05 },
  'Eine irreguläre Zwerggalaxie voller leuchtender Gasnebel, entdeckt von E. E. Barnard im Jahr 1884.', [['Durchmesser', '≈ 7.000 Lj']], { importance: 4, labelMax: 2e7 });
G('ic10', 'IC 10', 'Starburst-Zwerggalaxie', 0.338, 59.30, 2.2 * MLY, 5000,
  { kind: 'irregular', incl: 40, pa: 40, count: 0.04, starburst: true },
  'Die einzige bekannte Starburst-Galaxie der Lokalen Gruppe – hier entstehen ungewöhnlich viele neue Sterne.', [['Durchmesser', '≈ 5.000 Lj']], { importance: 3, labelMax: 1.2e7 });
G('leo1', 'Leo I', 'Zwerg-Sphäroidal', 10.141, 12.306, 820000, 2500,
  { kind: 'dwarf', incl: 50, pa: 80, count: 0.02, q: 0.75 },
  'Eine der entferntesten Begleitgalaxien der Milchstraße – am Himmel steht sie dicht neben dem hellen Stern Regulus.', [['Durchmesser', '≈ 2.500 Lj']], { importance: 3, labelMax: 5e6 });
G('draco', 'Draco-Zwerggalaxie', 'Zwerg-Sphäroidal', 17.337, 57.915, 260000, 2700,
  { kind: 'dwarf', incl: 50, pa: 80, count: 0.015, q: 0.7 },
  'Eine der lichtschwächsten Galaxien überhaupt – sie besteht überwiegend aus Dunkler Materie.', [['Durchmesser', '≈ 2.700 Lj']], { importance: 3, labelMax: 3e6 });
G('fornaxdsph', 'Fornax-Zwerggalaxie', 'Zwerg-Sphäroidal', 2.666, -34.45, 460000, 6000,
  { kind: 'dwarf', incl: 50, pa: 40, count: 0.03, q: 0.7 },
  'Eine kugelförmige Zwerggalaxie mit gleich sechs eigenen Kugelsternhaufen.', [['Durchmesser', '≈ 6.000 Lj']], { importance: 3, labelMax: 4e6 });
G('sculptordsph', 'Sculptor-Zwerggalaxie', 'Zwerg-Sphäroidal', 1.0025, -33.71, 290000, 3000,
  { kind: 'dwarf', incl: 50, pa: 100, count: 0.02, q: 0.7 },
  'Eine der ersten entdeckten Zwerg-Sphäroidalgalaxien (1937) – alt, staubfrei und arm an Gas.', [['Durchmesser', '≈ 3.000 Lj']], { importance: 3, labelMax: 3e6 });
G('wlm', 'Wolf-Lundmark-Melotte', 'Irreguläre Zwerggalaxie', 0.0328, -15.46, 3.04 * MLY, 8000,
  { kind: 'irregular', incl: 70, pa: 0, count: 0.04 },
  'Eine einsame Zwerggalaxie am äußersten Rand der Lokalen Gruppe, die nie mit großen Nachbarn wechselwirkte.', [['Durchmesser', '≈ 8.000 Lj']], { importance: 3, labelMax: 1.5e7 });
G('ic1613', 'IC 1613', 'Irreguläre Zwerggalaxie', 1.0799, 2.13, 2.38 * MLY, 10000,
  { kind: 'irregular', incl: 35, pa: 60, count: 0.04 },
  'Eine ruhige, irreguläre Zwerggalaxie – ein wichtiger Prüfstein für kosmische Entfernungsmessungen.', [['Durchmesser', '≈ 10.000 Lj']], { importance: 3, labelMax: 1.5e7 });

G('m81', 'Bodes Galaxie', 'Spiralgalaxie · M81', 9.926, 69.065, 11.8 * MLY, 90000,
  { kind: 'spiral', arms: 2, incl: 59, pa: 157, count: 0.45, bulge: 0.2, pitch: 14 },
  'Eine prachtvolle „Grand Design“-Spiralgalaxie, die gravitativ mit ihrer Nachbarin, der Zigarrengalaxie, wechselwirkt.', [['Durchmesser', '≈ 90.000 Lj'], ['Sterne', '≈ 250 Mrd.']], { importance: 7 });
G('m82', 'Zigarrengalaxie', 'Starburst-Galaxie · M82', 9.931, 69.68, 11.4 * MLY, 37000,
  { kind: 'starburst', incl: 82, pa: 65, count: 0.25, viewPitch: 8 },
  'Die Begegnung mit M81 löste eine heftige Sternentstehung aus, deren galaktische Winde rote Gasfontänen ins All blasen.', [['Durchmesser', '≈ 37.000 Lj'], ['Sternentstehung', '10× Milchstraße']], { importance: 6 });
G('cena', 'Centaurus A', 'Elliptische Radiogalaxie · NGC 5128', 13.424, -43.019, 12 * MLY, 60000,
  { kind: 'elliptical', dustLane: true, jet: true, incl: 60, pa: 120, count: 0.4, q: 0.85 },
  'Eine riesige elliptische Galaxie mit markantem Staubband – Spur einer Kollision. Ihr Schwarzes Loch schleudert Jets über eine Million Lichtjahre weit.', [['Durchmesser', '≈ 60.000 Lj (sichtbar)'], ['Schwarzes Loch', '55 Mio. Sonnen']], { importance: 7 });
G('ngc253', 'Sculptor-Galaxie', 'Starburst-Spirale · NGC 253', 0.7925, -25.29, 11.4 * MLY, 90000,
  { kind: 'spiral', arms: 2, incl: 76, pa: 52, count: 0.4, bulge: 0.08, pitch: 16, dusty: true, viewPitch: 14 },
  'Eine der staubigsten Galaxien und eine der hellsten außerhalb der Lokalen Gruppe – mit intensiver Sternentstehung im Kern.', [['Durchmesser', '≈ 90.000 Lj']], { importance: 5 });
G('m83', 'Südliche Feuerradgalaxie', 'Balkenspirale · M83', 13.617, -29.866, 15 * MLY, 55000,
  { kind: 'spiral', arms: 2, bar: 0.25, incl: 24, pa: 45, count: 0.35, bulge: 0.12, pitch: 18 },
  'Eine Balkenspirale mit außergewöhnlich vielen Supernovae – sechs wurden allein im 20. Jahrhundert beobachtet.', [['Durchmesser', '≈ 55.000 Lj']], { importance: 5 });
G('m51', 'Whirlpool-Galaxie', 'Spiralgalaxie · M51', 13.498, 47.195, 23 * MLY, 76000,
  { kind: 'spiral', arms: 2, incl: 20, pa: 163, count: 0.5, bulge: 0.12, pitch: 18, companion: true, viewPitch: 60 },
  'Die erste Galaxie, bei der eine Spiralstruktur erkannt wurde (1845). Sie zieht gerade ihre kleine Begleitgalaxie NGC 5195 an sich.', [['Durchmesser', '≈ 76.000 Lj']], { importance: 7 });
G('m101', 'Feuerradgalaxie', 'Spiralgalaxie · M101', 14.054, 54.349, 21 * MLY, 170000,
  { kind: 'spiral', arms: 4, incl: 18, pa: 39, count: 0.6, bulge: 0.08, pitch: 20, flocculent: true, viewPitch: 60 },
  'Eine riesige, fast kreisrunde Spirale – beinahe doppelt so groß wie die Milchstraße.', [['Durchmesser', '≈ 170.000 Lj'], ['Sterne', '≈ 1 Billion']], { importance: 6 });
G('m104', 'Sombrerogalaxie', 'Linsenförmige Galaxie · M104', 12.6664, -11.623, 31 * MLY, 50000,
  { kind: 'sombrero', incl: 84, pa: 90, count: 0.45, viewPitch: 6 },
  'Ihr gleißender Kern und das dunkle Staubband lassen sie wie einen mexikanischen Hut aussehen.', [['Durchmesser', '≈ 50.000 Lj'], ['Kugelsternhaufen', '≈ 2.000']], { importance: 7 });
G('m87', 'M87', 'Elliptische Riesengalaxie · Virgo A', 12.5137, 12.391, 53.5 * MLY, 120000,
  { kind: 'elliptical', jet: true, incl: 45, pa: 290, count: 0.6, q: 0.92, giant: true },
  'Eine gigantische elliptische Galaxie im Herzen des Virgo-Haufens mit Billionen Sternen und einem 5.000 Lichtjahre langen Materiestrahl.', [['Durchmesser', '≈ 120.000 Lj'], ['Kugelsternhaufen', '≈ 12.000']], { importance: 8 });
G('m64', 'Black-Eye-Galaxie', 'Spiralgalaxie · M64', 12.946, 21.68, 17 * MLY, 54000,
  { kind: 'spiral', arms: 2, incl: 60, pa: 115, count: 0.3, bulge: 0.2, pitch: 10, dusty: true },
  'Ein dunkles Staubband vor ihrem hellen Kern lässt sie aussehen wie ein „blaues Auge“.', [['Durchmesser', '≈ 54.000 Lj']], { importance: 4 });
G('ngc1300', 'NGC 1300', 'Balkenspiralgalaxie', 3.328, -19.41, 61 * MLY, 110000,
  { kind: 'spiral', arms: 2, bar: 0.45, incl: 35, pa: 106, count: 0.4, bulge: 0.08, pitch: 12, viewPitch: 55 },
  'Eine Lehrbuch-Balkenspiralgalaxie mit einem markanten zentralen Balken, aus dessen Enden die Spiralarme entspringen.', [['Durchmesser', '≈ 110.000 Lj']], { importance: 5 });
G('antennae', 'Antennen-Galaxien', 'Kollidierende Galaxien · NGC 4038/9', 12.031, -18.87, 45 * MLY, 500000,
  { kind: 'merger', incl: 40, pa: 30, count: 0.5, viewPitch: 55 },
  'Zwei Galaxien mitten im Zusammenstoß. Die herausgeschleuderten Sternströme erinnern an die Fühler eines Insekts.', [['Ausdehnung inkl. Schweife', '≈ 500.000 Lj']], { importance: 6 });
G('cartwheel', 'Wagenradgalaxie', 'Ringgalaxie', 0.628, -33.716, 500 * MLY, 150000,
  { kind: 'ring', incl: 40, pa: 10, count: 0.4, viewPitch: 60 },
  'Eine kleinere Galaxie durchschlug ihre Scheibe vor einigen hundert Millionen Jahren und löste eine ringförmige Welle der Sternentstehung aus.', [['Durchmesser', '≈ 150.000 Lj']], { importance: 5, labelMax: 1.2e9 });
G('hoag', 'Hoags Objekt', 'Ringgalaxie', 15.287, 21.585, 600 * MLY, 100000,
  { kind: 'ring', perfect: true, incl: 15, pa: 0, count: 0.35, viewPitch: 70 },
  'Ein nahezu perfekter Ring junger blauer Sterne um einen gelben Kern – wie sie entstand, ist bis heute rätselhaft.', [['Durchmesser', '≈ 100.000 Lj']], { importance: 5, labelMax: 1.2e9 });

add({ id: 'm87bh', name: 'M87*', cat: 'blackhole', type: 'Supermassereiches Schwarzes Loch', parent: 'm87',
  radius: 1.92e10 * KM_LY, labelMax: 150000, importance: 7,
  bh: { rs: 1.92e10 * KM_LY, jet: true }, view: { r: 1.92e10 * KM_LY * 24, pitch: 14 },
  desc: 'Das erste fotografierte Schwarze Loch (Event Horizon Telescope, 2019). Mit 6,5 Milliarden Sonnenmassen wäre sein Ereignishorizont größer als unser gesamtes Planetensystem.',
  facts: [['Masse', '6,5 Mrd. Sonnen'], ['Ereignishorizont', '≈ 38 Mrd. km Ø']] });
BY_ID.get('m87bh').pos.copy(BY_ID.get('m87').pos);

// --- Haufen, Superstrukturen & Regionen -------------------------------------
function C(id, name, type, ra, dec, d, r, desc, facts, extra = {}) {
  return add({ id, name, cat: 'cluster', type, ra, dec, dist: d, radius: r, pos: radecToWorld(ra, dec, d),
    labelMax: extra.labelMax ?? Math.max(1.5e9, d * 4), importance: 6, view: { r: r * 2.6, pitch: 30 }, regionR: r, desc, facts, ...extra });
}
add({ id: 'localgroup', name: 'Lokale Gruppe', cat: 'region', type: 'Galaxiengruppe', radius: 5 * MLY,
  pos: BY_ID.get('andromeda').pos.clone().multiplyScalar(0.42).add(GC_POS.clone().multiplyScalar(0.58)),
  labelMax: 2.5e8, importance: 9, view: { r: 9.5 * MLY, pitch: 35 }, regionR: 5 * MLY,
  desc: 'Unsere galaktische Nachbarschaft: über 80 Galaxien auf rund 10 Millionen Lichtjahren, dominiert von der Andromeda-Galaxie und der Milchstraße.',
  facts: [['Durchmesser', '≈ 10 Mio. Lj'], ['Galaxien', '> 80'], ['Größte Mitglieder', 'Andromeda, Milchstraße, M33']] });
C('virgo', 'Virgo-Haufen', 'Galaxienhaufen', 12.5137, 12.391, 53.5 * MLY, 7.5 * MLY,
  'Der nächste große Galaxienhaufen mit über 1.300 Galaxien. Seine Schwerkraft bremst die Flucht der Lokalen Gruppe und zieht uns langsam an.', [['Galaxien', '> 1.300'], ['Durchmesser', '≈ 15 Mio. Lj']], { importance: 8 });
add({ id: 'virgosc', name: 'Virgo-Superhaufen', cat: 'region', type: 'Superhaufen', radius: 55 * MLY,
  pos: radecToWorld(12.5137, 12.391, 30 * MLY), labelMax: 2.5e9, importance: 8, view: { r: 150 * MLY, pitch: 30 }, regionR: 58 * MLY,
  desc: 'Auch Lokaler Superhaufen genannt: ein Verbund aus mindestens 100 Galaxiengruppen und -haufen, darunter die Lokale Gruppe. Er ist Teil des noch größeren Laniakea.',
  facts: [['Durchmesser', '≈ 110 Mio. Lj'], ['Galaxiengruppen', '> 100']] });
C('fornaxc', 'Fornax-Haufen', 'Galaxienhaufen', 3.64, -35.45, 62 * MLY, 3 * MLY,
  'Der zweitreichste Galaxienhaufen innerhalb von 100 Millionen Lichtjahren – kompakt und dominiert von elliptischen Galaxien.', [['Galaxien', '≈ 60']], { importance: 4 });
C('greatattractor', 'Großer Attraktor', 'Gravitationsanomalie · Norma-Haufen', 16.25, -60.9, 220 * MLY, 15 * MLY,
  'Ein Schwerkraftzentrum, auf das sich Tausende Galaxien unserer Umgebung zubewegen – verborgen hinter der Scheibe der Milchstraße.', [['Masse', '≈ 10¹⁶ Sonnen']], { importance: 7 });
add({ id: 'laniakea', name: 'Laniakea-Superhaufen', cat: 'region', type: 'Superhaufen · unsere Heimat', radius: 260 * MLY,
  pos: radecToWorld(16.25, -60.9, 220 * MLY).multiplyScalar(0.9), labelMax: 2e10, importance: 9, view: { r: 800 * MLY, pitch: 30 }, regionR: 265 * MLY,
  desc: 'Hawaiianisch für „unermesslicher Himmel“. Unser Heimat-Superhaufen umfasst rund 100.000 Galaxien auf etwa 520 Millionen Lichtjahren – alle strömen auf den Großen Attraktor zu.',
  facts: [['Durchmesser', '≈ 520 Mio. Lj'], ['Galaxien', '≈ 100.000'], ['Masse', '≈ 10¹⁷ Sonnen']] });
C('coma', 'Coma-Haufen', 'Galaxienhaufen · Abell 1656', 12.997, 27.98, 321 * MLY, 10 * MLY,
  'Ein riesiger Haufen aus über 1.000 Galaxien. Hier fand Fritz Zwicky 1933 erste Hinweise auf die Dunkle Materie.', [['Galaxien', '> 1.000'], ['Durchmesser', '≈ 20 Mio. Lj']], { importance: 7 });
C('perseusc', 'Perseus-Haufen', 'Galaxienhaufen · Abell 426', 3.33, 41.51, 240 * MLY, 8 * MLY,
  'Eines der massereichsten Objekte im nahen Universum. Sein heißes Gas „singt“ einen Ton – 57 Oktaven unter dem mittleren C.', [['Galaxien', '> 1.000']], { importance: 5 });
C('hydrac', 'Hydra-Haufen', 'Galaxienhaufen · Abell 1060', 10.61, -27.53, 190 * MLY, 5 * MLY,
  'Ein reicher Galaxienhaufen im Laniakea-Superhaufen mit rund 160 hellen Galaxien.', [['Galaxien', '≈ 160 helle']], { importance: 3 });
C('centaurusc', 'Centaurus-Haufen', 'Galaxienhaufen · Abell 3526', 12.81, -41.3, 170 * MLY, 6 * MLY,
  'Ein großer Galaxienhaufen im Herzen des Laniakea-Superhaufens.', [['Galaxien', 'Hunderte']], { importance: 3 });
C('herculesc', 'Herkules-Haufen', 'Galaxienhaufen · Abell 2151', 16.0875, 17.73, 500 * MLY, 7 * MLY,
  'Ein junger Haufen voller spiralförmiger und miteinander wechselwirkender Galaxien.', [['Galaxien', '≈ 200']], { importance: 4 });
C('shapley', 'Shapley-Superhaufen', 'Superhaufen', 13.466, -31.5, 650 * MLY, 100 * MLY,
  'Die größte Massekonzentration im lokalen Universum – sie zieht zusammen mit dem Großen Attraktor an unserer Galaxiengruppe.', [['Galaxienhaufen', '> 25'], ['Masse', '≈ 10¹⁷ Sonnen']], { importance: 6 });
C('bootes', 'Bootes-Leere', 'Kosmische Leere', 14.83, 46.0, 700 * MLY, 165 * MLY,
  'Das „Große Nichts“: eine fast leere Blase von rund 330 Millionen Lichtjahren Durchmesser. Gleichmäßig verteilt müssten hier Tausende Galaxien liegen – man fand nur rund 60.', [['Durchmesser', '≈ 330 Mio. Lj'], ['Galaxien', '≈ 60']], { importance: 6, void: true });
C('sloanwall', 'Sloan Great Wall', 'Galaxien-Filament', 13.0, 1.0, 1.0 * GLY, 680 * MLY,
  'Eine der größten bekannten Strukturen: eine Wand aus Galaxien, rund 1,4 Milliarden Lichtjahre lang.', [['Länge', '≈ 1,4 Mrd. Lj']], { importance: 6, labelMax: 4e10 });
C('bullet', 'Bullet-Cluster', 'Kollidierende Haufen · 1E 0657-56', 6.977, -55.95, 3.9 * GLY, 8 * MLY,
  'Zwei kollidierende Galaxienhaufen: Der Zusammenstoß trennte das heiße Gas von der Dunklen Materie – ein direkter Beleg für deren Existenz.', [['Rotverschiebung', 'z = 0,296']], { importance: 5, labelMax: 4e10 });
C('q3c273', 'Quasar 3C 273', 'Quasar', 12.485, 2.05, 2.15 * GLY, 200000,
  'Der erste identifizierte Quasar (1963): ein aktives Schwarzes Loch, das heller strahlt als 4 Billionen Sonnen.', [['Rotverschiebung', 'z = 0,158'], ['Schwarzes Loch', '≈ 890 Mio. Sonnen']], { importance: 6, labelMax: 6e10, view: { r: 3e6, pitch: 20 }, quasar: true });
C('ton618', 'TON 618', 'Hyperleuchtkräftiger Quasar', 12.474, 31.48, 18.2 * GLY, 300000,
  'Ein extrem heller Quasar mit einem der massereichsten bekannten Schwarzen Löcher – rund 40 Milliarden Sonnenmassen.', [['Rotverschiebung', 'z = 2,22'], ['Schwarzes Loch', '≈ 40 Mrd. Sonnen']], { importance: 6, labelMax: 1e11, view: { r: 4e6, pitch: 20 }, quasar: true });
C('hcbgw', 'Herkules-Corona-Borealis-Mauer', 'Größte bekannte Struktur', 16.0, 27.0, 16 * GLY, 4.5 * GLY,
  'Die größte bekannte Struktur im Universum – eine Ansammlung von Gammablitz-Galaxien über rund 10 Milliarden Lichtjahre (ihre Existenz ist umstritten).', [['Länge', '≈ 10 Mrd. Lj'], ['Rotverschiebung', 'z ≈ 1,6 – 2,1']], { importance: 6, labelMax: 2e11 });
C('gnz11', 'GN-z11', 'Frühe Galaxie', 12.607, 62.24, 32 * GLY, 1500,
  'Eine der fernsten bekannten Galaxien. Wir sehen sie, wie sie nur rund 400 Millionen Jahre nach dem Urknall aussah.', [['Rotverschiebung', 'z = 10,6']], { importance: 6, labelMax: 2e11, view: { r: 2e5, pitch: 20 }, early: true });
C('jades', 'JADES-GS-z14-0', 'Frühe Galaxie', 3.539, -27.86, 33.8 * GLY, 1600,
  'Vom James-Webb-Teleskop 2024 entdeckt: eine der frühesten bekannten Galaxien, nur rund 290 Millionen Jahre nach dem Urknall.', [['Rotverschiebung', 'z = 14,3']], { importance: 6, labelMax: 2e11, view: { r: 2e5, pitch: 20 }, early: true });
add({ id: 'universe', name: 'Beobachtbares Universum', cat: 'region', type: 'Kosmischer Horizont', radius: 46.5 * GLY, pos: new THREE.Vector3(0, 0, 0),
  labelMax: 0, importance: 10, view: { r: 135 * GLY, pitch: 25 }, regionR: 46.5 * GLY, up: 'gal',
  desc: 'Alles, was wir prinzipiell sehen können: eine Kugel von rund 93 Milliarden Lichtjahren Durchmesser mit etwa zwei Billionen Galaxien. Ihr Rand ist der kosmische Mikrowellenhintergrund – das älteste Licht, ausgesandt 380.000 Jahre nach dem Urknall.',
  facts: [['Durchmesser', '≈ 93 Mrd. Lj'], ['Galaxien', '≈ 2 Billionen'], ['Alter', '13,8 Mrd. Jahre'], ['CMB-Temperatur', '2,725 K']] });

// Regionen fürs Sonnensystem
BY_ID.get('sun').regionR = 1.6;

// Hilfen
export function upVector(o) {
  switch (o.up) {
    case 'ecl': return ECL_NORTH.clone();
    case 'eq': return EQ_NORTH.clone();
    case 'normal': return o.gal.normal.clone();
    case 'gal': return GAL_NORTH.clone();
    default:
      if (o.cat === 'planet' || o.cat === 'moon' || o.parent === 'sun') return ECL_NORTH.clone();
      return GAL_NORTH.clone();
  }
}

export function defaultViewR(o) {
  if (o.view?.r) return o.view.r;
  switch (o.cat) {
    case 'planet': case 'moon': return o.radius * 3.4;
    case 'star': return o.radius * 5;
    case 'nebula': return o.radius * 3.2;
    case 'galaxy': return o.radius * 2.5;
    case 'blackhole': return o.radius * 28;
    default: return o.radius * 2.5;
  }
}

export const CAT_LABEL = EN ? EN_CAT_LABEL : {
  planet: 'Planet', moon: 'Mond', star: 'Stern', nebula: 'Nebel', galaxy: 'Galaxie', blackhole: 'Schwarzes Loch',
  cluster: 'Struktur', region: 'Region', probe: 'Raumsonde',
};

// Englische Texte übernehmen
if (EN) {
  for (const o of CATALOG) {
    const e = EN_CATALOG[o.id];
    if (!e) continue;
    [o.name, o.type, o.desc] = e;
    if (e[3]) o.facts = e[3];
  }
}

export { radecToDir };
