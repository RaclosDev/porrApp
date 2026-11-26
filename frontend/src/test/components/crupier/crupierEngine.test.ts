import { describe, expect, it } from 'vitest';
import { crupierMarkup } from '../../../components/poker/crupier/crupierArt';
import { CrupierEngine, type CrupierAction } from '../../../components/poker/crupier/crupierEngine';

function setup(auto = false, still = false) {
  const box = document.createElement('div');
  box.innerHTML = crupierMarkup('t', 'verde');
  const svg = box.querySelector('svg')!;
  return { svg, engine: new CrupierEngine(svg, 0, auto, still) };
}

const shown = (svg: SVGSVGElement, name: string) =>
  (svg.querySelector(`.${name}`) as SVGElement).style.display !== 'none';

/** Recorre un rato fotograma a fotograma y apunta qué piezas han salido. */
function run(engine: CrupierEngine, svg: SVGSVGElement, from: number, to: number, watch: string[]) {
  const seen = new Set<string>();
  for (let t = from; t <= to; t += 1 / 30) {
    engine.frame(t);
    watch.filter((name) => shown(svg, name)).forEach((name) => seen.add(name));
  }
  return seen;
}

const PROPS: Record<CrupierAction, string[]> = {
  barajar: ['p-sh0', 'p-sh6'],
  repartir: ['p-card', 'p-fly'],
  saludar: [],
  ficha: ['p-chip', 'p-sparks'],
  guino: ['p-sparks'],
  gracias: ['p-sign'],
  campana: ['p-bell', 'p-rope', 'p-ding'],
  revolver: ['p-gun', 'p-bang', 'p-smoke'],
  aviso: ['p-watch', 'p-chain', 'p-min'],
  pausa: ['p-cup', 'p-steam', 'p-break'],
  caja: ['p-register', 'p-coins', 'p-ching'],
  despertar: ['p-wake'],
  eliminado: [],
};

describe('crupierMarkup', () => {
  it('da a cada instancia sus propios id', () => {
    const markup = crupierMarkup('abc', 'bombin');
    expect(markup).toMatch(/id="grainabc"/);
    expect(markup).toMatch(/url\(#grainabc\)/);
    expect(markup).not.toMatch(/id="grain"/);
  });
});

describe('CrupierEngine', () => {
  it.each(Object.entries(PROPS))('%s saca sus piezas y las guarda al acabar', (name, props) => {
    const { svg, engine } = setup();
    engine.play(name as CrupierAction, 0);
    const seen = run(engine, svg, 0, 4, props);
    expect([...seen].sort()).toEqual([...props].sort());
    props.forEach((prop) => expect(shown(svg, prop)).toBe(false));
  });

  it('cuadra el golpe de la acción con el arranque del sonido', () => {
    const { svg, engine } = setup();
    engine.play('revolver', 0, 1);
    // La acción empieza 0,7 s antes del sonido y el fogonazo sale con la primera bala.
    engine.frame(0.2);
    expect(shown(svg, 'p-gun')).toBe(false);
    engine.frame(1.02);
    expect(svg.querySelector('.p-flash')!.getAttribute('visibility')).toBe('visible');
    engine.frame(1.2);
    expect(svg.querySelector('.p-flash')!.getAttribute('visibility')).toBe('hidden');
  });

  it('se duerme en el descanso y se despierta de un respingo al acabar', () => {
    const { svg, engine } = setup();
    engine.setAsleep(true, 0);
    run(engine, svg, 0, 2, []);
    expect(engine.isSleeping).toBe(true);
    expect(shown(svg, 'p-zzz')).toBe(true);
    engine.setAsleep(false, 2);
    const seen = run(engine, svg, 2, 3, ['p-wake']);
    expect(engine.isSleeping).toBe(false);
    expect(seen.has('p-wake')).toBe(true);
  });

  it('no se duerme mientras tiene un aviso pendiente', () => {
    const { svg, engine } = setup();
    engine.play('pausa', 0, 1);
    engine.setAsleep(true, 0);
    engine.frame(0.1);
    expect(engine.isSleeping).toBe(false);
    run(engine, svg, 0.1, 5, []);
    expect(engine.isSleeping).toBe(true);
  });

  it('un aviso lo despierta sin esperar a que acabe el descanso', () => {
    const { svg, engine } = setup();
    engine.setAsleep(true, 0);
    run(engine, svg, 0, 2, []);
    engine.play('campana', 2);
    engine.frame(2.1);
    expect(engine.isSleeping).toBe(false);
    expect(shown(svg, 'p-bell')).toBe(true);
  });

  it('hace gestos al azar cuando no pasa nada', () => {
    const { svg, engine } = setup(true);
    const props = ['p-sh0', 'p-card', 'p-chip', 'p-sparks'];
    const seen = run(engine, svg, 0, 30, props);
    expect(seen.size).toBeGreaterThan(0);
  });

  it('sin movimiento se queda quieto y duerme sin animar', () => {
    const { svg, engine } = setup(true, true);
    engine.play('barajar', 0);
    engine.frame(1);
    expect(shown(svg, 'p-sh0')).toBe(false);
    engine.frame(3);
    engine.setAsleep(true, 3);
    engine.frame(3);
    expect(engine.isSleeping).toBe(true);
    expect(shown(svg, 'z0')).toBe(true);
  });

  it('avisa si falta una pieza del dibujo', () => {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    const engine = new CrupierEngine(svg, 0, false);
    expect(() => engine.frame(0)).toThrow(/Falta/);
  });
});
