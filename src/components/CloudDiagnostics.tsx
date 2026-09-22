// Diagnóstico de la nube: qué hay exactamente en la cuenta de Google y qué hay en este
// navegador, lado a lado, con dos botones para forzar el sentido de la copia.
//
// Existe porque la sincronización automática es una caja negra: cuando algo no cuadra
// ("he entrado en otro navegador y no veo mis clientes"), lo primero es poder mirar dentro
// sin depender de deducciones. Aquí se lee la nube directamente del servidor, saltándose la
// caché local, y se dice en castellano qué hay en cada sitio.
import React, { useState } from 'react';
import { Cloud, Download, Upload, RefreshCw, AlertTriangle, CheckCircle2, Search } from 'lucide-react';
import { AppState } from '../types';
import { InformeNube } from '../lib/cloudSync';
import { tieneDatosPropios } from '../lib/storage';
import { fechaHoraES } from '../utils/dates';

interface Props {
  firebaseUser: any;
  estadoCompleto: AppState;
  estadoNube: string;
  errorNube: string | null;
  onInspeccionar: () => Promise<InformeNube>;
  onTraer: () => Promise<void>;
  onSubir: () => Promise<void>;
  onAviso?: (texto: string, tipo?: 'ok' | 'error' | 'info') => void;
}

const n = (l?: unknown[]) => (l || []).length;
const fecha = (iso?: string) => (iso ? fechaHoraES(iso.replace('Z', '')) : 'sin fecha');

function Resumen({ titulo, st, kb, extra }: { titulo: string; st: AppState | null; kb?: number; extra?: React.ReactNode }) {
  return (
    <div className="p-3 bg-white rounded-xl border border-slate-200 space-y-1">
      <p className="font-bold text-slate-800">{titulo}</p>
      {!st ? <p className="text-slate-500">Vacío: no hay ningún estado guardado.</p> : (
        <>
          <p className="text-slate-700"><b>{n(st.clients)}</b> clientes · <b>{n(st.projects)}</b> presupuestos y obras · <b>{n(st.invoices)}</b> facturas · <b>{n(st.expenses)}</b> gastos · <b>{n(st.catalogItems)}</b> materiales · <b>{n(st.kits)}</b> kits</p>
          <p className="text-[11px] text-slate-500">Guardado el {fecha(st.updatedAt)}{kb !== undefined ? ` · ${kb} KB` : ''}{st.deviceId ? ` · dispositivo ${String(st.deviceId).slice(0, 8)}` : ''}</p>
          <p className={`text-[11px] font-bold ${tieneDatosPropios(st) ? 'text-emerald-700' : 'text-amber-700'}`}>{tieneDatosPropios(st) ? 'Contiene datos tuyos.' : 'Solo contiene los ejemplos de muestra (o está vacío).'}</p>
          {extra}
        </>
      )}
    </div>
  );
}

export const CloudDiagnostics: React.FC<Props> = ({ firebaseUser, estadoCompleto, estadoNube, errorNube, onInspeccionar, onTraer, onSubir, onAviso }) => {
  const [informe, setInforme] = useState<InformeNube | null>(null);
  const [ocupado, setOcupado] = useState<'mirar' | 'traer' | 'subir' | null>(null);
  const [fallo, setFallo] = useState<string | null>(null);

  const mirar = async () => {
    setOcupado('mirar'); setFallo(null);
    try { setInforme(await onInspeccionar()); } catch (e: any) { setFallo(e?.message || 'No se ha podido leer la nube.'); } finally { setOcupado(null); }
  };
  const traer = async () => {
    if (!informe?.principal) return;
    const ok = window.confirm('Vas a sustituir lo que hay en ESTE navegador por lo que hay en la nube. Lo de aquí queda guardado como versión anterior (recuperable en Copias de seguridad). ¿Seguir?');
    if (!ok) return;
    setOcupado('traer'); setFallo(null);
    try { await onTraer(); onAviso?.('Datos de la nube cargados en este navegador.', 'ok'); await mirar(); } catch (e: any) { setFallo(e?.message || 'No se ha podido traer la nube.'); } finally { setOcupado(null); }
  };
  const subir = async () => {
    const ok = window.confirm('Vas a sustituir lo que hay en la NUBE por lo que hay en este navegador. Los demás dispositivos lo recibirán al abrirse. Si la nube tenía algo que aquí no está, se perderá (queda la foto manual, si hiciste alguna). ¿Seguir?');
    if (!ok) return;
    setOcupado('subir'); setFallo(null);
    try { await onSubir(); onAviso?.('Este navegador se ha subido a la nube.', 'ok'); await mirar(); } catch (e: any) { setFallo(e?.message || 'No se ha podido subir a la nube.'); } finally { setOcupado(null); }
  };

  if (!firebaseUser) return null;

  const aqui = tieneDatosPropios(estadoCompleto);
  const nube = informe?.principal ? tieneDatosPropios(informe.principal) : false;
  let veredicto: { tono: 'ok' | 'aviso' | 'error'; texto: string } | null = null;
  if (informe) {
    if (!informe.principal) veredicto = { tono: 'error', texto: 'En la nube de esta cuenta no hay ningún estado guardado. Si tus datos están en otro navegador, ábrelo y pulsa allí «Subir este navegador a la nube» (o descarga una copia y impórtala aquí).' };
    else if (nube && !aqui) veredicto = { tono: 'aviso', texto: 'La nube tiene tus datos y este navegador solo los ejemplos. Pulsa «Traer la nube a este navegador».' };
    else if (!nube && aqui) veredicto = { tono: 'aviso', texto: 'Este navegador tiene tus datos y la nube solo ejemplos. Pulsa «Subir este navegador a la nube» para que los demás dispositivos los reciban.' };
    else if (!nube && !aqui) veredicto = { tono: 'error', texto: 'Ni la nube ni este navegador tienen datos tuyos: solo ejemplos. Tus datos deben estar en el navegador donde trabajabas; ábrelo y súbelos desde allí, o importa aquí una copia local (.json). Comprueba también que has entrado con la MISMA cuenta de Google: la de la nube es ' + (firebaseUser.email || '') + '.' };
    else if (informe.principal.updatedAt !== estadoCompleto.updatedAt) veredicto = { tono: 'aviso', texto: 'Los dos lados tienen datos tuyos pero no son la misma versión. Compara las cifras y elige qué lado manda.' };
    else veredicto = { tono: 'ok', texto: 'Nube y navegador coinciden.' };
  }

  return (
    <div className="mt-3 p-4 bg-white rounded-2xl border border-indigo-200 space-y-3 text-xs">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <p className="font-black text-slate-900 flex items-center gap-1.5"><Search size={14} className="text-indigo-600" /> ¿Qué hay en la nube y qué hay aquí?</p>
          <p className="text-[11px] text-slate-500">Cuenta: <b>{firebaseUser.email}</b>. Se lee directamente del servidor, sin caché. No cambia nada hasta que pulses uno de los dos botones de abajo.</p>
        </div>
        <button type="button" onClick={mirar} disabled={ocupado !== null} className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold flex items-center gap-1.5 cursor-pointer disabled:opacity-50">{ocupado === 'mirar' ? <RefreshCw size={13} className="animate-spin" /> : <Search size={13} />} Mirar la nube</button>
      </div>

      {(errorNube || estadoNube === 'error') && (
        <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-900 flex items-start gap-2"><AlertTriangle size={14} className="shrink-0 mt-0.5" /><span><b>La sincronización automática está fallando:</b> {errorNube || 'error desconocido'}. Hasta que se arregle, lo que cambies aquí no llega a la nube.</span></div>
      )}
      {fallo && <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-900">{fallo}</div>}

      {informe && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            <Resumen titulo={<><Cloud size={13} className="inline mr-1 text-indigo-600" />En la nube (tu cuenta de Google)</> as any} st={informe.principal} kb={informe.kb}
              extra={informe.copiaManual ? <p className="text-[11px] text-slate-500">Además hay una foto manual del {fecha(informe.copiaManual.updatedAt)} con {n(informe.copiaManual.clients)} clientes y {n(informe.copiaManual.invoices)} facturas (se restaura desde Copias de seguridad).</p> : <p className="text-[11px] text-slate-400">Sin foto manual.</p>} />
            <Resumen titulo="En este navegador" st={estadoCompleto} />
          </div>
          {veredicto && (
            <div className={`p-3 rounded-xl border flex items-start gap-2 ${veredicto.tono === 'ok' ? 'bg-emerald-50 border-emerald-200 text-emerald-900' : veredicto.tono === 'aviso' ? 'bg-amber-50 border-amber-200 text-amber-900' : 'bg-rose-50 border-rose-200 text-rose-900'}`}>
              {veredicto.tono === 'ok' ? <CheckCircle2 size={14} className="shrink-0 mt-0.5" /> : <AlertTriangle size={14} className="shrink-0 mt-0.5" />}<span>{veredicto.texto}</span>
            </div>
          )}
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={traer} disabled={ocupado !== null || !informe.principal} className="px-3.5 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-800 rounded-xl font-bold flex items-center gap-1.5 cursor-pointer disabled:opacity-50"><Download size={13} /> Traer la nube a este navegador</button>
            <button type="button" onClick={subir} disabled={ocupado !== null} className="px-3.5 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-800 rounded-xl font-bold flex items-center gap-1.5 cursor-pointer disabled:opacity-50"><Upload size={13} /> Subir este navegador a la nube</button>
          </div>
        </>
      )}
    </div>
  );
};
