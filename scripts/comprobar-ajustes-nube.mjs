// Comprueba que ninguna opción de configuración se quede guardada solo en el navegador.
//
// Lo que se guarda suelto en localStorage NO viaja a la cuenta de Google: al abrir la app en
// otro equipo, se pierde. Pasó de verdad con los trimestres ya entregados a la gestoría, con
// los apartados del Resumen y con la vista de Clientes. Todo eso vive ahora en CompanySettings,
// que sí se sube.
//
// Esta lista es la única excepción permitida. Si aparece una clave nueva, la comprobación falla
// a propósito: decide si es de verdad de este dispositivo (y la añades aquí con su motivo) o si
// es configuración del usuario (y entonces va en CompanySettings).
//
//     node scripts/comprobar-ajustes-nube.mjs
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const SOLO_DE_ESTE_NAVEGADOR = {
  'obracontrol-estado-v1': 'el estado completo, que es justo lo que se sube a la nube',
  'obracontrol-copia-anterior': 'copia de rescate local: la red por si la nube se equivoca',
  'obracontrol-dispositivo': 'identifica a este equipo para no procesar el eco de sus propios cambios',
  'obracontrol-version-nube': 'qué versión de la nube vio este equipo la última vez',
  'obracontrol-ultima-copia': 'cuándo se descargó aquí una copia en archivo',
  'obracontrol_google_token': 'permiso de Google de esta sesión (sessionStorage); por seguridad nunca se comparte entre dispositivos',
};

// Claves que existieron y ahora solo se LEEN, para rescatarlas a la configuración
const MIGRADAS = [
  'obracontrol-trimestres-entregados',
  'obracontrol_dashboard_widgets',
  'obracontrol-clientes-modo',
];

const ficheros = [];
(function recorrer(dir) {
  for (const n of readdirSync(dir)) {
    const p = join(dir, n);
    if (statSync(p).isDirectory()) recorrer(p);
    else if (n.endsWith('.ts') || n.endsWith('.tsx')) ficheros.push(p);
  }
})('src');

// Se buscan las escrituras (setItem), que son las que dejan algo atrapado aquí. Las lecturas
// valen: son las que rescatan lo antiguo.
const escrituras = new Map();
for (const p of ficheros) {
  const texto = readFileSync(p, 'utf8');
  for (const almacen of ['localStorage.setItem(', 'sessionStorage.setItem(']) {
    let i = 0;
    while ((i = texto.indexOf(almacen, i)) !== -1) {
      const desde = i + almacen.length;
      const resto = texto.slice(desde, desde + 200).trimStart();
      let clave = '';
      const comilla = resto[0];
      if (comilla === "'" || comilla === '"' || comilla === '`') {
        const fin = resto.indexOf(comilla, 1);
        if (fin > 0) clave = resto.slice(1, fin);
      } else {
        // setItem(CLAVE, …): se busca a qué cadena corresponde la constante
        const nombre = (resto.match(/^[A-Za-z_$][\w$]*/) || [''])[0];
        const def = nombre && texto.match(new RegExp(nombre + "\\s*=\\s*['\"]([^'\"]+)['\"]"));
        clave = def ? def[1] : nombre;
      }
      if (clave && !escrituras.has(clave)) escrituras.set(clave, p.split('\\').join('/'));
      i = desde;
    }
  }
}

const problemas = [];
for (const [clave, donde] of escrituras) {
  if (MIGRADAS.includes(clave)) {
    problemas.push(`«${clave}» vuelve a escribirse en ${donde}: se migró a la configuración, no debe guardarse en el navegador.`);
  } else if (!(clave in SOLO_DE_ESTE_NAVEGADOR)) {
    problemas.push(`«${clave}» se guarda solo en el navegador (${donde}) y no llegará a la nube. Si es configuración del usuario, muévela a CompanySettings; si de verdad es de este dispositivo, añádela a SOLO_DE_ESTE_NAVEGADOR con su motivo.`);
  }
}

if (problemas.length) {
  console.error('nube · hay ajustes que no llegarían a la nube MAL');
  for (const p of problemas) console.error('   - ' + p);
  process.exit(1);
}
console.log(`nube · ningún ajuste se queda fuera de la nube OK (${escrituras.size} claves, todas justificadas)`);
