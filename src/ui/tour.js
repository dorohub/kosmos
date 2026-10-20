import { AU_LY } from '../core/units.js';
import { BY_ID } from '../data/catalog.js';
import { ECL_NORTH, GAL_NORTH } from '../core/coords.js';
import { EN, t } from '../i18n.js';

const STOPS = [
  { id: 'earth', title: 'Die Erde', text: 'Unser Ausgangspunkt: ein blauer Planet, 12.742 km groß. Alles, was Menschen je erlebt haben, geschah hier – auf diesem winzigen Punkt im All.' },
  { id: 'moon', title: 'Der Mond', text: '384.400 km entfernt – Licht braucht gut eine Sekunde bis hierher. Weiter sind Menschen nie gereist.' },
  { id: 'saturn', title: 'Saturn', text: 'Ein Gasriese mit Ringen aus Milliarden Eisbrocken. Das Sonnenlicht ist hier schon 80 Minuten unterwegs.' },
  { id: 'sun', title: 'Die Sonne', text: 'Ein gewöhnlicher Stern – und doch 99,86 % der Masse des gesamten Sonnensystems. In ihrem Kern herrschen 15 Millionen Grad.' },
  { obj: 'sun', r: 85 * AU_LY, pitch: 0.75, up: 'ecl', title: 'Das Sonnensystem', text: 'Acht Planeten auf nahezu kreisförmigen Bahnen. Selbst Neptun ist nur 4 Lichtstunden von der Sonne entfernt.' },
  { id: 'oort', title: 'Die Oortsche Wolke', text: 'Billionen Eiskörper in einer riesigen Kugelschale – die äußerste Grenze unseres Sonnensystems, fast zwei Lichtjahre weit draußen.' },
  { id: 'alphacen', title: 'Alpha Centauri', text: 'Der nächste Stern: 4,37 Lichtjahre. Mit heutigen Raketen bräuchten wir rund 70.000 Jahre bis hierher.' },
  { id: 'betelgeuse', title: 'Beteigeuze', text: 'Ein Roter Überriese, der an der Stelle der Sonne bis über die Marsbahn reichen würde. Er steht kurz – kosmisch gesehen – vor seiner Supernova.' },
  { id: 'orion', title: 'Der Orionnebel', text: 'Eine Kinderstube der Sterne: Aus diesen leuchtenden Gaswolken entstehen gerade Tausende neuer Sonnen – und vielleicht Planeten.' },
  { id: 'sgra', title: 'Sagittarius A*', text: 'Das Herz unserer Galaxie: ein Schwarzes Loch mit 4,3 Millionen Sonnenmassen. Nicht einmal Licht entkommt seinem Ereignishorizont.' },
  { id: 'milkyway', title: 'Die Milchstraße', text: 'Unsere Galaxie aus Hunderten Milliarden Sternen. Die Sonne ist nur ein Lichtpunkt im Orion-Arm, 26.700 Lichtjahre vom Zentrum entfernt.' },
  { id: 'lmc', title: 'Die Große Magellansche Wolke', text: 'Eine Begleitgalaxie, die die Milchstraße umkreist – vom Südhimmel aus mit bloßem Auge als heller Nebelfleck zu sehen.' },
  { id: 'andromeda', title: 'Die Andromeda-Galaxie', text: '2,5 Millionen Lichtjahre entfernt. Das Licht, das wir heute von ihr sehen, startete, als die ersten Menschen auf der Erde lebten.' },
  { id: 'localgroup', title: 'Die Lokale Gruppe', text: 'Über 80 Galaxien, gravitativ aneinander gebunden. Andromeda und die Milchstraße rasen mit 110 km/s aufeinander zu.' },
  { id: 'm87bh', title: 'M87* im Virgo-Haufen', text: 'Das erste Schwarze Loch, das je fotografiert wurde: 6,5 Milliarden Sonnenmassen im Zentrum einer Riesengalaxie, 53 Millionen Lichtjahre entfernt.' },
  { id: 'laniakea', title: 'Laniakea', text: 'Unser Superhaufen: 100.000 Galaxien, die wie Wasser in ein gemeinsames Tal strömen – zum Großen Attraktor.' },
  { obj: null, r: 7.5e9, pitch: 0.5, up: 'gal', title: 'Das kosmische Netz', text: 'Auf den größten Skalen ordnen sich Galaxien zu Fäden und Wänden um gewaltige Leerräume – das Skelett des Universums, geformt von Dunkler Materie.' },
  { id: 'universe', title: 'Das beobachtbare Universum', text: '93 Milliarden Lichtjahre Durchmesser. Dahinter liegt der Mikrowellenhintergrund – das Nachglühen des Urknalls. Weiter können wir nicht sehen.' },
  { id: 'earth', title: 'Zurück nach Hause', text: 'Von all dem, was wir gesehen haben, gibt es nur einen Ort, den wir Heimat nennen. Danke für die Reise!' },
];

const STOPS_EN = [
  ['Earth', 'Our starting point: a blue planet, 12,742 km across. Everything humans have ever experienced happened here – on this tiny dot in space.'],
  ['The Moon', '384,400 km away – light needs just over a second to get here. Humans have never traveled farther.'],
  ['Saturn', 'A gas giant with rings made of billions of chunks of ice. Sunlight has already been traveling for 80 minutes to reach it.'],
  ['The Sun', 'An ordinary star – yet 99.86% of the mass of the entire Solar System. Its core reaches 15 million degrees.'],
  ['The Solar System', 'Eight planets on nearly circular orbits. Even Neptune is only 4 light-hours from the Sun.'],
  ['The Oort Cloud', 'Trillions of icy bodies in a vast spherical shell – the outermost edge of our Solar System, almost two light-years out.'],
  ['Alpha Centauri', 'The nearest star system: 4.37 light-years. With today\'s rockets it would take us about 70,000 years to get here.'],
  ['Betelgeuse', 'A red supergiant that would reach beyond the orbit of Mars if it replaced the Sun. It is – cosmically speaking – close to going supernova.'],
  ['The Orion Nebula', 'A stellar nursery: thousands of new suns – and perhaps planets – are forming in these glowing gas clouds right now.'],
  ['Sagittarius A*', 'The heart of our galaxy: a black hole of 4.3 million solar masses. Not even light escapes its event horizon.'],
  ['The Milky Way', 'Our galaxy of hundreds of billions of stars. The Sun is just a speck in the Orion Arm, 26,700 light-years from the center.'],
  ['The Large Magellanic Cloud', 'A satellite galaxy orbiting the Milky Way – visible to the naked eye from the southern hemisphere as a bright smudge.'],
  ['The Andromeda Galaxy', '2.5 million light-years away. The light we see from it today set out when the first humans walked the Earth.'],
  ['The Local Group', 'More than 80 galaxies bound together by gravity. Andromeda and the Milky Way are rushing toward each other at 110 km/s.'],
  ['M87* in the Virgo Cluster', 'The first black hole ever photographed: 6.5 billion solar masses at the center of a giant galaxy, 53 million light-years away.'],
  ['Laniakea', 'Our supercluster: 100,000 galaxies flowing like water into a common valley – toward the Great Attractor.'],
  ['The cosmic web', 'On the largest scales, galaxies line up in filaments and walls around enormous voids – the skeleton of the universe, shaped by dark matter.'],
  ['The observable universe', '93 billion light-years across. Beyond lies the cosmic microwave background – the afterglow of the Big Bang. We cannot see any farther.'],
  ['Back home', 'Of everything we have seen, there is only one place we call home. Thanks for the journey!'],
];

export class Tour {
  constructor(app) {
    this.app = app;
    this.el = document.getElementById('caption');
    this.stepEl = this.el.querySelector('.cap-step');
    this.titleEl = this.el.querySelector('.cap-title');
    this.textEl = this.el.querySelector('.cap-text');
    this.bar = this.el.querySelector('.cap-bar i');
    this.btnPause = this.el.querySelector('.cap-pause');
    this.active = false;
    this.el.querySelector('.cap-stop').onclick = () => this.stop();
    this.el.querySelector('.cap-next').onclick = () => this.go(this.i + 1);
    this.el.querySelector('.cap-prev').onclick = () => this.go(Math.max(0, this.i - 1));
    this.btnPause.onclick = () => this.togglePause();
  }

  start() {
    if (this.app.autopilot?.active) this.app.autopilot.stop();
    this.active = true;
    this.el.classList.remove('hidden');
    document.getElementById('btn-tour').classList.add('on');
    this.go(0);
  }

  stop() {
    const wasActive = this.active;
    this.active = false;
    if (wasActive && this.onEnd) { const f = this.onEnd; this.onEnd = null; setTimeout(f, 1500); }
    this.token = null;
    this.el.classList.add('hidden');
    this.app.nav.autoOrbit = 0;
    document.getElementById('btn-tour').classList.remove('on');
  }

  togglePause() {
    this.paused = !this.paused;
    this.btnPause.textContent = this.paused ? '▶' : '❚❚';
    if (!this.paused && this.waitingResume) {
      this.waitingResume = false;
      this.go(this.i);
    }
  }

  async go(i) {
    if (i >= STOPS.length) return this.stop();
    this.i = i;
    this.paused = false;
    this.waitingResume = false;
    this.btnPause.textContent = '❚❚';
    const token = (this.token = {});
    const s = STOPS[i];
    this.stepEl.textContent = t('STATION {i} / {n}', { i: i + 1, n: STOPS.length });
    this.titleEl.textContent = EN ? STOPS_EN[i][0] : s.title;
    this.textEl.textContent = EN ? STOPS_EN[i][1] : s.text;
    this.bar.style.width = '0%';
    this.el.style.animation = 'none';
    void this.el.offsetWidth;
    this.el.style.animation = '';
    this.app.nav.autoOrbit = 0;
    let ok;
    if (s.id) {
      const o = BY_ID.get(s.id);
      this.app.select(o, { quiet: true });
      ok = await this.app.flyToObject(o);
    } else {
      this.app.select(s.obj ? BY_ID.get(s.obj) : null, { quiet: true });
      ok = await this.app.nav.flyTo({
        obj: s.obj ? BY_ID.get(s.obj) : null, pos: BY_ID.get('earth').pos.clone().multiplyScalar(0), r: s.r, pitch: s.pitch,
        up: s.up === 'ecl' ? ECL_NORTH : GAL_NORTH,
      });
    }
    if (token !== this.token) return;
    if (!ok) { this.paused = true; this.waitingResume = true; this.btnPause.textContent = '▶'; return; }
    this.app.nav.autoOrbit = 0.06;
    const hold = 8.5;
    let elapsed = 0;
    let last = performance.now();
    await new Promise((resolve) => {
      const tick = () => {
        if (token !== this.token) return resolve();
        const now = performance.now();
        if (!this.paused) elapsed += (now - last) / 1000;
        last = now;
        this.bar.style.width = Math.min(100, (elapsed / hold) * 100) + '%';
        if (elapsed >= hold) return resolve();
        requestAnimationFrame(tick);
      };
      tick();
    });
    if (token !== this.token) return;
    this.go(i + 1);
  }
}
